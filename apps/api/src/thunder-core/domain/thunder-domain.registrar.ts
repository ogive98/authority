import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InvMovementType, SalOrderStatus } from '@prisma/client';
import { FinanceGlPostingService } from '../../accounting/finance-gl-posting.service';
import { FinanceService } from '../../finance/finance.service';
import { InventoryService } from '../../inventory/inventory.service';
import { ModuleRegistryService } from '../../modules-registry/module-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SALES_RESERVE_REF_TYPE, SALES_SETTING_KEYS } from '../../sales/sales.constants';
import type { AuthorityEventEnvelope } from '../events/event-envelope';
import { ConsumerRegistryService } from '../events/consumer-registry.service';
import {
  THUNDER_DOMAIN_CONSUMERS,
  THUNDER_DOMAIN_EVENT_TYPES,
} from './thunder-domain.constants';

/**
 * Real domain consumers beyond thunder.intel (EVENT_BUS named groups).
 * Effects stay in module services; Thunder only wires the HOW.
 */
@Injectable()
export class ThunderDomainRegistrar implements OnModuleInit {
  private readonly logger = new Logger(ThunderDomainRegistrar.name);

  constructor(
    private readonly registry: ConsumerRegistryService,
    private readonly modules: ModuleRegistryService,
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly finance: FinanceService,
    private readonly financeGl: FinanceGlPostingService,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      THUNDER_DOMAIN_CONSUMERS.inventoryReserveFromOrder,
      (envelope) => this.onSalesConfirmedReserve(envelope),
      { consumes: [THUNDER_DOMAIN_EVENT_TYPES.salesConfirmed] },
    );
    this.registry.register(
      THUNDER_DOMAIN_CONSUMERS.financeOpenItemFromDelivery,
      (envelope) => this.onShipmentDeliveredAr(envelope),
      { consumes: [THUNDER_DOMAIN_EVENT_TYPES.shipmentDelivered] },
    );
    this.registry.register(
      THUNDER_DOMAIN_CONSUMERS.accountingPostFromFinance,
      (envelope) => this.onFinanceToGl(envelope),
      {
        consumes: [
          THUNDER_DOMAIN_EVENT_TYPES.financeInvoiceIssued,
          THUNDER_DOMAIN_EVENT_TYPES.financeInvoiceCancelled,
          THUNDER_DOMAIN_EVENT_TYPES.financePaymentAllocated,
          THUNDER_DOMAIN_EVENT_TYPES.financePaymentReversed,
          THUNDER_DOMAIN_EVENT_TYPES.financeInstrumentRejected,
        ],
      },
    );
  }

  async onSalesConfirmedReserve(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    const companyId = envelope.companyId;
    if (!companyId) return;
    if (!(await this.modules.isEnabled(companyId, 'inventory'))) {
      return;
    }
    if (!(await this.isReserveOnConfirm(companyId))) {
      return;
    }

    const orderId =
      stringPayload(envelope.payload, 'orderId') || envelope.aggregateId;
    const order = await this.prisma.salOrder.findFirst({
      where: {
        id: orderId,
        companyId,
        deletedAt: null,
        status: SalOrderStatus.CONFIRMED,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!order) {
      this.logger.warn(
        `inventory.reserveFromOrder: order ${orderId} not found/confirmed`,
      );
      return;
    }

    let reserved = 0;
    let skipped = 0;
    for (const line of order.lines) {
      const qty = Number(line.qty.toString());
      if (!Number.isFinite(qty) || qty <= 0) continue;

      const existing = await this.prisma.invMovement.findFirst({
        where: {
          companyId,
          type: InvMovementType.RESERVE,
          refType: SALES_RESERVE_REF_TYPE,
          refId: order.id,
          balance: { productId: line.productId },
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await this.inventory.reserve(companyId, {
        productId: line.productId,
        warehouseId: order.warehouseId,
        qty,
        refType: SALES_RESERVE_REF_TYPE,
        refId: order.id,
      });
      reserved += 1;
    }

    this.logger.log(
      `inventory.reserveFromOrder order=${order.number} reserved=${reserved} skipped=${skipped}`,
    );
  }

  async onShipmentDeliveredAr(
    envelope: AuthorityEventEnvelope,
  ): Promise<void> {
    const companyId = envelope.companyId;
    if (!companyId) return;
    if (!(await this.modules.isEnabled(companyId, 'finance'))) {
      return;
    }

    const orderId =
      stringPayload(envelope.payload, 'orderId') ||
      stringPayload(envelope.payload, 'salesOrderId');
    const customerId = stringPayload(envelope.payload, 'customerId');
    if (!orderId || !customerId) {
      this.logger.warn(
        'finance.openItemFromDelivery: missing orderId/customerId in payload',
      );
      return;
    }

    const order = await this.prisma.salOrder.findFirst({
      where: { id: orderId, companyId, deletedAt: null },
      select: {
        id: true,
        number: true,
        customerId: true,
        amountTotal: true,
        currency: true,
      },
    });
    if (!order || order.customerId !== customerId) {
      this.logger.warn(
        `finance.openItemFromDelivery: order ${orderId} mismatch`,
      );
      return;
    }

    const amount = Number(order.amountTotal.toString());
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const result = await this.finance.ensureArForSalesOrder(companyId, {
      customerId: order.customerId,
      salesOrderId: order.id,
      amountTotal: amount,
      orderNumber: order.number,
      currency: order.currency,
    });
    this.logger.log(
      `finance.openItemFromDelivery ${result.outcome} ${result.item.number} order=${order.number}`,
    );
  }

  async onFinanceToGl(envelope: AuthorityEventEnvelope): Promise<void> {
    const companyId = envelope.companyId;
    if (!companyId) return;
    if (!(await this.modules.isEnabled(companyId, 'accounting'))) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    if (envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeInvoiceIssued) {
      const invoiceId =
        stringPayload(envelope.payload, 'invoiceId') || envelope.aggregateId;
      const amount = numberPayload(envelope.payload, 'amountTotal');
      const amountHt = numberPayload(envelope.payload, 'amountHt');
      const amountTax = numberPayload(envelope.payload, 'amountTax');
      if (!invoiceId || amount == null) {
        this.logger.warn('accounting.postFromFinance invoice: missing fields');
        return;
      }
      const result = await this.financeGl.postInvoiceIssued(companyId, {
        sourceId: envelope.eventId,
        invoiceId,
        amount,
        amountHt: amountHt ?? undefined,
        amountTax: amountTax ?? undefined,
        entryDate: today,
        description: `invoice:${invoiceId}`,
      });
      this.logger.log(
        `accounting.postFromFinance invoice ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeInvoiceCancelled
    ) {
      const invoiceId =
        stringPayload(envelope.payload, 'invoiceId') || envelope.aggregateId;
      if (!invoiceId) {
        this.logger.warn(
          'accounting.postFromFinance cancel: missing invoiceId',
        );
        return;
      }
      const result = await this.financeGl.reverseInvoiceIssued(companyId, {
        invoiceId,
        reverseSourceId: envelope.eventId,
      });
      this.logger.log(
        `accounting.postFromFinance cancel ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financePaymentAllocated
    ) {
      const paymentId =
        stringPayload(envelope.payload, 'paymentId') || envelope.aggregateId;
      const amount =
        numberPayload(envelope.payload, 'amountAllocated') ??
        numberPayload(envelope.payload, 'amount');
      if (!paymentId || amount == null) {
        this.logger.warn('accounting.postFromFinance payment: missing fields');
        return;
      }
      const result = await this.financeGl.postPaymentAllocated(companyId, {
        sourceId: envelope.eventId,
        paymentId,
        amount,
        entryDate: today,
      });
      this.logger.log(
        `accounting.postFromFinance payment ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financePaymentReversed ||
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeInstrumentRejected
    ) {
      const paymentId = stringPayload(envelope.payload, 'paymentId');
      if (!paymentId) {
        this.logger.warn(
          'accounting.postFromFinance payment reverse: missing paymentId',
        );
        return;
      }
      const sourceType =
        envelope.eventType ===
        THUNDER_DOMAIN_EVENT_TYPES.financePaymentReversed
          ? 'fin_payment_reverse'
          : 'fin_instrument_reject';
      const result = await this.financeGl.reversePaymentOnInstrumentReject(
        companyId,
        {
          paymentId,
          rejectSourceId: envelope.eventId,
          sourceType,
        },
      );
      this.logger.log(
        `accounting.postFromFinance ${sourceType} ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
    }
  }

  private async isReserveOnConfirm(companyId: string): Promise<boolean> {
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: SALES_SETTING_KEYS.RESERVE_ON_CONFIRM,
        scopeKey: `company:${companyId}`,
        deletedAt: null,
      },
    });
    if (!row) return true;
    const raw = row.valueJson;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw === 'true' || raw === '1';
    return Boolean(raw);
  }
}

function stringPayload(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const v = payload[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function numberPayload(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const v = payload[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

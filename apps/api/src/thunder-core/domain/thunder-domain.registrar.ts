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
          THUNDER_DOMAIN_EVENT_TYPES.financeCreditNoteIssued,
          THUNDER_DOMAIN_EVENT_TYPES.financePaymentAllocated,
          THUNDER_DOMAIN_EVENT_TYPES.financePaymentReversed,
          THUNDER_DOMAIN_EVENT_TYPES.financeInstrumentRejected,
          THUNDER_DOMAIN_EVENT_TYPES.financeBankFeePosted,
          THUNDER_DOMAIN_EVENT_TYPES.financeApBillPosted,
          THUNDER_DOMAIN_EVENT_TYPES.financeApBillCancelled,
          THUNDER_DOMAIN_EVENT_TYPES.financeApPaymentPosted,
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
    const shipmentId =
      stringPayload(envelope.payload, 'shipmentId') ||
      (envelope.aggregateType === 'dlv_shipment'
        ? envelope.aggregateId
        : undefined);
    if (!orderId || !customerId) {
      this.logger.warn(
        'finance.openItemFromDelivery: missing orderId/customerId in payload',
      );
      return;
    }

    // Sync Delivery.complete already creates shipment-scoped invoice (D315).
    if (shipmentId) {
      const existing = await this.prisma.finInvoice.findFirst({
        where: {
          companyId,
          shipmentId,
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        select: { id: true, number: true },
      });
      if (existing) {
        this.logger.log(
          `finance.openItemFromDelivery skip — invoice ${existing.number} already exists for shipment ${shipmentId}`,
        );
        return;
      }
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

    const payloadLines = Array.isArray(envelope.payload?.lines)
      ? (envelope.payload.lines as Array<Record<string, unknown>>)
      : [];
    const qtyByLine = new Map<string, number>();
    for (const row of payloadLines) {
      const lineId =
        typeof row.orderLineId === 'string' ? row.orderLineId : null;
      const qty = typeof row.qty === 'number' ? row.qty : Number(row.qty);
      if (lineId && Number.isFinite(qty) && qty > 0) {
        qtyByLine.set(lineId, qty);
      }
    }

    const lines: Array<{
      description: string;
      qty: number;
      unitPriceHt: number;
      productId: string;
    }> = [];

    const orderLines = await this.prisma.salOrderLine.findMany({
      where: { orderId: order.id, companyId },
      orderBy: { lineNo: 'asc' },
    });
    const productIds = [...new Set(orderLines.map((l) => l.productId))];
    const products =
      productIds.length > 0
        ? await this.prisma.prdProduct.findMany({
            where: { companyId, id: { in: productIds }, deletedAt: null },
            select: { id: true, name: true, sku: true },
          })
        : [];
    const nameById = new Map(
      products.map((p) => [p.id, `${p.sku} — ${p.name}`] as const),
    );

    for (const line of orderLines) {
      const qty =
        qtyByLine.get(line.id) ??
        (shipmentId ? 0 : Number(line.qty.toString()));
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const discountFactor = 1 - Number(line.discountPct.toString()) / 100;
      const unitPriceHt =
        Math.round(Number(line.unitPrice.toString()) * discountFactor * 1000) /
        1000;
      lines.push({
        description:
          nameById.get(line.productId) ??
          `Produit ${line.productId.slice(0, 8)}`,
        qty,
        unitPriceHt,
        productId: line.productId,
      });
    }

    const amount =
      lines.length > 0
        ? lines.reduce((s, l) => s + l.qty * l.unitPriceHt, 0)
        : Number(order.amountTotal.toString());
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const shipmentNumber = stringPayload(envelope.payload, 'number');
    const result = await this.finance.ensureArForSalesOrder(companyId, {
      customerId: order.customerId,
      salesOrderId: order.id,
      amountTotal: amount,
      orderNumber: order.number,
      currency: order.currency,
      shipmentId: shipmentId ?? null,
      shipmentNumber: shipmentNumber ?? null,
      lines: lines.length > 0 ? lines : undefined,
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
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeCreditNoteIssued
    ) {
      const creditNoteId =
        stringPayload(envelope.payload, 'creditNoteId') ||
        envelope.aggregateId;
      const amount = numberPayload(envelope.payload, 'amountTotal');
      const amountHt = numberPayload(envelope.payload, 'amountHt');
      const amountTax = numberPayload(envelope.payload, 'amountTax');
      if (!creditNoteId || amount == null) {
        this.logger.warn(
          'accounting.postFromFinance credit_note: missing fields',
        );
        return;
      }
      const result = await this.financeGl.postCreditNoteIssued(companyId, {
        sourceId: envelope.eventId,
        creditNoteId,
        amount,
        amountHt: amountHt ?? undefined,
        amountTax: amountTax ?? undefined,
        entryDate: today,
        description: `credit_note:${creditNoteId}`,
      });
      this.logger.log(
        `accounting.postFromFinance credit_note ${result.outcome} ${
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
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeBankFeePosted
    ) {
      const statementLineId =
        stringPayload(envelope.payload, 'statementLineId') ||
        envelope.aggregateId;
      const amount = numberPayload(envelope.payload, 'amount');
      const entryDate =
        stringPayload(envelope.payload, 'entryDate') || today;
      if (!statementLineId || amount == null) {
        this.logger.warn(
          'accounting.postFromFinance bank_fee: missing fields',
        );
        return;
      }
      const result = await this.financeGl.postBankFee(companyId, {
        sourceId: envelope.eventId,
        statementLineId,
        amount,
        entryDate,
      });
      this.logger.log(
        `accounting.postFromFinance bank_fee ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeApBillPosted
    ) {
      const billId =
        stringPayload(envelope.payload, 'billId') || envelope.aggregateId;
      const amount = numberPayload(envelope.payload, 'amountTotal');
      const amountHt = numberPayload(envelope.payload, 'amountHt') ?? 0;
      const amountTax = numberPayload(envelope.payload, 'amountTax') ?? 0;
      const entryDate =
        stringPayload(envelope.payload, 'billDate') || today;
      if (!billId || amount == null) {
        this.logger.warn(
          'accounting.postFromFinance ap_bill: missing fields',
        );
        return;
      }
      const result = await this.financeGl.postApBillPosted(companyId, {
        sourceId: envelope.eventId,
        billId,
        amount,
        amountHt,
        amountTax,
        entryDate,
        description: `ap_bill:${billId}`,
      });
      this.logger.log(
        `accounting.postFromFinance ap_bill ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeApBillCancelled
    ) {
      const billId =
        stringPayload(envelope.payload, 'billId') || envelope.aggregateId;
      if (!billId) {
        this.logger.warn(
          'accounting.postFromFinance ap_bill cancel: missing billId',
        );
        return;
      }
      const result = await this.financeGl.reverseApBillPosted(companyId, {
        billId,
        reverseSourceId: envelope.eventId,
      });
      this.logger.log(
        `accounting.postFromFinance ap_bill cancel ${result.outcome} ${
          'number' in result ? result.number : result.reason
        }`,
      );
      return;
    }

    if (
      envelope.eventType === THUNDER_DOMAIN_EVENT_TYPES.financeApPaymentPosted
    ) {
      const apPaymentId =
        stringPayload(envelope.payload, 'apPaymentId') ||
        envelope.aggregateId;
      const amount = numberPayload(envelope.payload, 'amount');
      const amountRas = numberPayload(envelope.payload, 'amountRas') ?? 0;
      const rasApplied = booleanPayload(envelope.payload, 'rasApplied');
      const entryDate =
        stringPayload(envelope.payload, 'paymentDate') ||
        stringPayload(envelope.payload, 'accountingDate') ||
        today;
      if (!apPaymentId || amount == null) {
        this.logger.warn(
          'accounting.postFromFinance ap_payment: missing fields',
        );
        return;
      }
      const result = await this.financeGl.postApPaymentPosted(companyId, {
        sourceId: envelope.eventId,
        apPaymentId,
        amount,
        amountRas,
        rasApplied,
        entryDate,
      });
      this.logger.log(
        `accounting.postFromFinance ap_payment ${result.outcome} ${
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

function booleanPayload(
  payload: Record<string, unknown>,
  key: string,
): boolean {
  const v = payload[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}

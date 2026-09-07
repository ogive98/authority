import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InvMovementType, SalOrderStatus } from '@prisma/client';
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

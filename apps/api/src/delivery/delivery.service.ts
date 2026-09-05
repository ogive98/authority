import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DlvShipment,
  DlvShipmentStatus,
  Prisma,
  SalOrder,
  SalOrderLine,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { SALES_SETTING_KEYS } from '../sales/sales.constants';
import {
  DELIVERY_ERROR_CODES,
  DELIVERY_EVENT_TYPES,
  DELIVERY_ISSUE_REF_TYPE,
  SALES_RESERVE_REF_TYPE,
} from './delivery.constants';
import { DeliveryException } from './delivery.exception';
import type {
  AssignDriverDto,
  CreateShipmentDto,
  FailShipmentDto,
} from './delivery.dto';

export type ShipmentDto = {
  id: string;
  companyId: string;
  number: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  status: DlvShipmentStatus;
  driverLabel: string | null;
  preferredDriver: string | null;
  failReason: string | null;
  version: number;
  assignedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EligibleOrderDto = {
  id: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  preferredDriver: string | null;
  amountTotal: string;
  confirmedAt: string | null;
  lineCount: number;
};

type OrderWithLines = SalOrder & { lines: SalOrderLine[] };

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      status?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: ShipmentDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();

    const where: Prisma.DlvShipmentWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(status &&
      Object.values(DlvShipmentStatus).includes(status as DlvShipmentStatus)
        ? { status: status as DlvShipmentStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { driverLabel: { contains: q, mode: 'insensitive' } },
              { preferredDriver: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.dlvShipment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1]?.id ?? null : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(companyId: string, id: string): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async listEligibleOrders(
    companyId: string,
    opts?: { q?: string; limit?: number },
  ): Promise<{ items: EligibleOrderDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);
    const q = opts?.q?.trim();

    const shipped = await this.prisma.dlvShipment.findMany({
      where: { companyId, deletedAt: null },
      select: { orderId: true },
    });
    const shippedIds = shipped.map((s) => s.orderId);

    const orders = await this.prisma.salOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: SalOrderStatus.CONFIRMED,
        id: shippedIds.length ? { notIn: shippedIds } : undefined,
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { preferredDriver: { contains: q, mode: 'insensitive' } },
                { notes: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { lines: true },
      orderBy: [{ confirmedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return { items: await this.enrichEligible(companyId, orders) };
  }

  async create(
    companyId: string,
    dto: CreateShipmentDto,
  ): Promise<ShipmentDto> {
    const order = await this.prisma.salOrder.findFirst({
      where: { id: dto.orderId, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!order) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_NOT_FOUND,
        'Sales order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (order.status !== SalOrderStatus.CONFIRMED) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_NOT_CONFIRMED,
        'Only confirmed orders can be shipped.',
        HttpStatus.CONFLICT,
      );
    }

    const existing = await this.prisma.dlvShipment.findFirst({
      where: { companyId, orderId: order.id, deletedAt: null },
    });
    if (existing) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_ALREADY_SHIPPED,
        'A shipment already exists for this order.',
        HttpStatus.CONFLICT,
      );
    }

    const driver =
      dto.driverLabel?.trim() || order.preferredDriver?.trim() || null;
    const status = driver
      ? DlvShipmentStatus.ASSIGNED
      : DlvShipmentStatus.READY;
    const number = await this.nextShipmentNumber(companyId);

    const row = await this.prisma.dlvShipment.create({
      data: {
        companyId,
        number,
        orderId: order.id,
        customerId: order.customerId,
        warehouseId: order.warehouseId,
        status,
        driverLabel: driver,
        preferredDriver: order.preferredDriver,
        assignedAt: driver ? new Date() : null,
      },
    });

    return this.enrichOne(companyId, row);
  }

  async assign(
    companyId: string,
    id: string,
    dto: AssignDriverDto,
  ): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status !== DlvShipmentStatus.READY &&
      row.status !== DlvShipmentStatus.ASSIGNED
    ) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.INVALID_STATUS,
        'Driver can only be assigned on READY or ASSIGNED shipments.',
        HttpStatus.CONFLICT,
      );
    }
    const driver = dto.driverLabel.trim();
    const updated = await this.prisma.dlvShipment.update({
      where: { id: row.id },
      data: {
        driverLabel: driver,
        status: DlvShipmentStatus.ASSIGNED,
        assignedAt: row.assignedAt ?? new Date(),
        version: { increment: 1 },
      },
    });
    return this.enrichOne(companyId, updated);
  }

  async dispatch(companyId: string, id: string): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status !== DlvShipmentStatus.READY &&
      row.status !== DlvShipmentStatus.ASSIGNED
    ) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.INVALID_STATUS,
        'Only READY or ASSIGNED shipments can be dispatched.',
        HttpStatus.CONFLICT,
      );
    }
    if (!row.driverLabel?.trim()) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.DRIVER_REQUIRED,
        'Assign a driver before dispatch.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.dlvShipment.update({
      where: { id: row.id },
      data: {
        status: DlvShipmentStatus.OUT,
        dispatchedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return this.enrichOne(companyId, updated);
  }

  async complete(companyId: string, id: string): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status !== DlvShipmentStatus.READY &&
      row.status !== DlvShipmentStatus.ASSIGNED &&
      row.status !== DlvShipmentStatus.OUT
    ) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.INVALID_STATUS,
        'Shipment cannot be completed from current status.',
        HttpStatus.CONFLICT,
      );
    }

    const order = await this.loadOrder(companyId, row.orderId);
    const reserveOnConfirm = await this.isReserveOnConfirm(companyId);
    const issued: Array<{ productId: string; qty: number }> = [];

    try {
      for (const line of order.lines) {
        const qty = Number(line.qty.toString());
        if (reserveOnConfirm) {
          await this.inventory.issue(companyId, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            qty,
            refType: DELIVERY_ISSUE_REF_TYPE,
            refId: row.id,
          });
        } else {
          await this.inventory.adjust(companyId, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            qtyDelta: -qty,
            reason: `delivery complete ${row.number}`,
          });
        }
        issued.push({ productId: line.productId, qty });
      }
    } catch (err) {
      for (const r of issued.reverse()) {
        try {
          if (reserveOnConfirm) {
            await this.inventory.reserve(companyId, {
              productId: r.productId,
              warehouseId: order.warehouseId,
              qty: r.qty,
              refType: SALES_RESERVE_REF_TYPE,
              refId: order.id,
            });
            await this.inventory.adjust(companyId, {
              productId: r.productId,
              warehouseId: order.warehouseId,
              qtyDelta: r.qty,
              reason: `compensate failed issue ${row.number}`,
            });
          } else {
            await this.inventory.adjust(companyId, {
              productId: r.productId,
              warehouseId: order.warehouseId,
              qtyDelta: r.qty,
              reason: `compensate failed delivery ${row.number}`,
            });
          }
        } catch {
          // best-effort compensate
        }
      }
      if (err instanceof DeliveryException) throw err;
      const message =
        err instanceof Error ? err.message : 'Stock issue failed.';
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.STOCK_ISSUE_FAILED,
        message,
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dlvShipment.updateMany({
        where: {
          id: row.id,
          companyId,
          status: { in: [row.status] },
          deletedAt: null,
        },
        data: {
          status: DlvShipmentStatus.DELIVERED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.INVALID_STATUS,
          'Shipment status changed during complete.',
          HttpStatus.CONFLICT,
        );
      }
      const fresh = await tx.dlvShipment.findFirstOrThrow({
        where: { id: row.id, companyId },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'dlv_shipment',
        aggregateId: fresh.id,
        eventType: DELIVERY_EVENT_TYPES.DELIVERED,
        payloadJson: {
          shipmentId: fresh.id,
          number: fresh.number,
          orderId: fresh.orderId,
          customerId: fresh.customerId,
          warehouseId: fresh.warehouseId,
          driverLabel: fresh.driverLabel,
        },
      });
      return fresh;
    });

    return this.enrichOne(companyId, updated);
  }

  async fail(
    companyId: string,
    id: string,
    dto: FailShipmentDto,
  ): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status !== DlvShipmentStatus.READY &&
      row.status !== DlvShipmentStatus.ASSIGNED &&
      row.status !== DlvShipmentStatus.OUT
    ) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.INVALID_STATUS,
        'Shipment cannot be failed from current status.',
        HttpStatus.CONFLICT,
      );
    }

    const order = await this.loadOrder(companyId, row.orderId);
    const reserveOnConfirm = await this.isReserveOnConfirm(companyId);

    if (reserveOnConfirm) {
      try {
        for (const line of order.lines) {
          await this.inventory.release(companyId, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            qty: Number(line.qty.toString()),
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Stock release failed.';
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.STOCK_RELEASE_FAILED,
          message,
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.dlvShipment.updateMany({
        where: {
          id: row.id,
          companyId,
          status: { in: [row.status] },
          deletedAt: null,
        },
        data: {
          status: DlvShipmentStatus.FAILED,
          failReason: dto.reason?.trim() || null,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.INVALID_STATUS,
          'Shipment status changed during fail.',
          HttpStatus.CONFLICT,
        );
      }
      const fresh = await tx.dlvShipment.findFirstOrThrow({
        where: { id: row.id, companyId },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'dlv_shipment',
        aggregateId: fresh.id,
        eventType: DELIVERY_EVENT_TYPES.FAILED,
        payloadJson: {
          shipmentId: fresh.id,
          number: fresh.number,
          orderId: fresh.orderId,
          reason: fresh.failReason,
        },
      });
      return fresh;
    });

    return this.enrichOne(companyId, updated);
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<DlvShipment> {
    const row = await this.prisma.dlvShipment.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.NOT_FOUND,
        'Shipment not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async loadOrder(
    companyId: string,
    orderId: string,
  ): Promise<OrderWithLines> {
    const order = await this.prisma.salOrder.findFirst({
      where: { id: orderId, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!order) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_NOT_FOUND,
        'Sales order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return order;
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

  private async nextShipmentNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SH-${year}-`;
    const count = await this.prisma.dlvShipment.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: DlvShipment[],
  ): Promise<ShipmentDto[]> {
    if (rows.length === 0) return [];
    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];

    const [orders, customers, warehouses] = await Promise.all([
      this.prisma.salOrder.findMany({
        where: { companyId, id: { in: orderIds } },
        select: { id: true, number: true },
      }),
      this.prisma.cusCustomer.findMany({
        where: { companyId, id: { in: customerIds } },
        include: { party: true },
      }),
      this.prisma.invWarehouse.findMany({
        where: { companyId, id: { in: warehouseIds } },
      }),
    ]);

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    return rows.map((row) => {
      const customer = customerMap.get(row.customerId);
      const warehouse = warehouseMap.get(row.warehouseId);
      const order = orderMap.get(row.orderId);
      return {
        id: row.id,
        companyId: row.companyId,
        number: row.number,
        orderId: row.orderId,
        orderNumber: order?.number ?? null,
        customerId: row.customerId,
        customerCode: customer?.code ?? null,
        customerName: customer?.party.legalName ?? null,
        warehouseId: row.warehouseId,
        warehouseCode: warehouse?.code ?? null,
        status: row.status,
        driverLabel: row.driverLabel,
        preferredDriver: row.preferredDriver,
        failReason: row.failReason,
        version: row.version,
        assignedAt: row.assignedAt?.toISOString() ?? null,
        dispatchedAt: row.dispatchedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private async enrichOne(
    companyId: string,
    row: DlvShipment,
  ): Promise<ShipmentDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto;
  }

  private async enrichEligible(
    companyId: string,
    orders: OrderWithLines[],
  ): Promise<EligibleOrderDto[]> {
    if (orders.length === 0) return [];
    const customerIds = [...new Set(orders.map((o) => o.customerId))];
    const warehouseIds = [...new Set(orders.map((o) => o.warehouseId))];
    const [customers, warehouses] = await Promise.all([
      this.prisma.cusCustomer.findMany({
        where: { companyId, id: { in: customerIds } },
        include: { party: true },
      }),
      this.prisma.invWarehouse.findMany({
        where: { companyId, id: { in: warehouseIds } },
      }),
    ]);
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    return orders.map((o) => {
      const customer = customerMap.get(o.customerId);
      const warehouse = warehouseMap.get(o.warehouseId);
      return {
        id: o.id,
        number: o.number,
        customerId: o.customerId,
        customerCode: customer?.code ?? null,
        customerName: customer?.party.legalName ?? null,
        warehouseId: o.warehouseId,
        warehouseCode: warehouse?.code ?? null,
        preferredDriver: o.preferredDriver,
        amountTotal: o.amountTotal.toString(),
        confirmedAt: o.confirmedAt?.toISOString() ?? null,
        lineCount: o.lines.length,
      };
    });
  }
}

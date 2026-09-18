import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  DlvRound,
  DlvRoundStatus,
  DlvShipment,
  DlvShipmentStatus,
  Prisma,
  SalOrder,
  SalOrderLine,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { FinanceService } from '../finance/finance.service';
import { InventoryService } from '../inventory/inventory.service';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
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
  AttachRoundDto,
  CompleteShipmentDto,
  CreateRoundDto,
  CreateShipmentDto,
  FailShipmentDto,
} from './delivery.dto';

export type RoundDto = {
  id: string;
  companyId: string;
  date: string;
  driverLabel: string;
  status: DlvRoundStatus;
  notes: string | null;
  version: number;
  shipmentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ShipmentOrderLineDto = {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  qty: string;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
  deliveredQty: string | null;
  remainingQty: string;
};

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
  roundId: string | null;
  roundDate: string | null;
  roundDriverLabel: string | null;
  status: DlvShipmentStatus;
  driverLabel: string | null;
  preferredDriver: string | null;
  failReason: string | null;
  amountDelivered: string | null;
  version: number;
  assignedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on GET shipment — lines for partial complete UI. */
  orderLines?: ShipmentOrderLineDto[];
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
  /** Lines still having remaining qty to deliver. */
  remainingLineCount: number;
  /** True when a prior DELIVERED/FAILED shipment exists. */
  followUp: boolean;
};

type OrderWithLines = SalOrder & { lines: SalOrderLine[] };

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
    private readonly finance: FinanceService,
    private readonly modules: ModuleRegistryService,
  ) {}

  async listRounds(
    companyId: string,
    opts?: { date?: string; limit?: number },
  ): Promise<{ items: RoundDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const dateFilter = opts?.date?.trim();
    const rows = await this.prisma.dlvRound.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(dateFilter
          ? { date: new Date(`${dateFilter.slice(0, 10)}T00:00:00.000Z`) }
          : {}),
      },
      include: {
        _count: { select: { shipments: { where: { deletedAt: null } } } },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return {
      items: rows.map((row) => serializeRound(row, row._count.shipments)),
    };
  }

  async getRound(companyId: string, id: string): Promise<RoundDto> {
    const row = await this.findActiveRound(companyId, id);
    const shipmentCount = await this.prisma.dlvShipment.count({
      where: { companyId, roundId: id, deletedAt: null },
    });
    return serializeRound(row, shipmentCount);
  }

  async createRound(
    companyId: string,
    dto: CreateRoundDto,
  ): Promise<RoundDto> {
    const day = dto.date.slice(0, 10);
    const row = await this.prisma.dlvRound.create({
      data: {
        companyId,
        date: new Date(`${day}T00:00:00.000Z`),
        driverLabel: dto.driverLabel.trim(),
        notes: dto.notes?.trim() || null,
        status: DlvRoundStatus.PLANNED,
      },
    });
    return serializeRound(row, 0);
  }

  /** Mission Control — in-flight shipment counts (READY / ASSIGNED / OUT). */
  async homeKpis(companyId: string): Promise<{
    activeCount: number;
    readyCount: number;
    assignedCount: number;
    outCount: number;
  }> {
    const base = { companyId, deletedAt: null as null };
    const [readyCount, assignedCount, outCount] = await Promise.all([
      this.prisma.dlvShipment.count({
        where: { ...base, status: DlvShipmentStatus.READY },
      }),
      this.prisma.dlvShipment.count({
        where: { ...base, status: DlvShipmentStatus.ASSIGNED },
      }),
      this.prisma.dlvShipment.count({
        where: { ...base, status: DlvShipmentStatus.OUT },
      }),
    ]);
    return {
      readyCount,
      assignedCount,
      outCount,
      activeCount: readyCount + assignedCount + outCount,
    };
  }

  async list(
    companyId: string,
    opts?: {
      q?: string;
      status?: string;
      customerId?: string;
      orderId?: string;
      roundId?: string;
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
      ...(opts?.orderId ? { orderId: opts.orderId } : {}),
      ...(opts?.roundId ? { roundId: opts.roundId } : {}),
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
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(companyId: string, id: string): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    const dto = await this.enrichOne(companyId, row);
    const order = await this.loadOrder(companyId, row.orderId);
    const productIds = [...new Set(order.lines.map((l) => l.productId))];
    const products = await this.prisma.prdProduct.findMany({
      where: { companyId, id: { in: productIds }, deletedAt: null },
      select: { id: true, sku: true, name: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    dto.orderLines = order.lines.map((l) => {
      const p = productMap.get(l.productId);
      return {
        id: l.id,
        lineNo: l.lineNo,
        productId: l.productId,
        productSku: p?.sku ?? null,
        productName: p?.name ?? null,
        qty: l.qty.toString(),
        unitPrice: l.unitPrice.toString(),
        discountPct: l.discountPct.toString(),
        lineTotal: l.lineTotal.toString(),
        deliveredQty: l.deliveredQty?.toString() ?? null,
        remainingQty: remainingQty(l).toString(),
      };
    });
    return dto;
  }

  async listEligibleOrders(
    companyId: string,
    opts?: { q?: string; limit?: number },
  ): Promise<{ items: EligibleOrderDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 50);
    const q = opts?.q?.trim();

    const openShipments = await this.prisma.dlvShipment.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: {
          in: [
            DlvShipmentStatus.READY,
            DlvShipmentStatus.ASSIGNED,
            DlvShipmentStatus.OUT,
          ],
        },
      },
      select: { orderId: true },
    });
    const blockedOrderIds = [...new Set(openShipments.map((s) => s.orderId))];

    const orders = await this.prisma.salOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: SalOrderStatus.CONFIRMED,
        id: blockedOrderIds.length ? { notIn: blockedOrderIds } : undefined,
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
      take: Math.min(limit * 4, 120),
    });

    const withRemaining = orders.filter((o) =>
      o.lines.some((l) => remainingQty(l) > 0),
    );
    const page = withRemaining.slice(0, limit);

    const prior = page.length
      ? await this.prisma.dlvShipment.findMany({
          where: {
            companyId,
            orderId: { in: page.map((o) => o.id) },
            deletedAt: null,
            status: {
              in: [DlvShipmentStatus.DELIVERED, DlvShipmentStatus.FAILED],
            },
          },
          select: { orderId: true },
        })
      : [];
    const followUpIds = new Set(prior.map((s) => s.orderId));

    return {
      items: await this.enrichEligible(companyId, page, followUpIds),
    };
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

    const remainingByProduct = new Map<string, number>();
    let hasRemaining = false;
    for (const line of order.lines) {
      const rem = remainingQty(line);
      if (rem > 0) {
        hasRemaining = true;
        remainingByProduct.set(
          line.productId,
          round3((remainingByProduct.get(line.productId) ?? 0) + rem),
        );
      }
    }
    if (!hasRemaining) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_FULLY_DELIVERED,
        'Order has no remaining qty to deliver.',
        HttpStatus.CONFLICT,
      );
    }

    const openExisting = await this.prisma.dlvShipment.findFirst({
      where: {
        companyId,
        orderId: order.id,
        deletedAt: null,
        status: {
          in: [
            DlvShipmentStatus.READY,
            DlvShipmentStatus.ASSIGNED,
            DlvShipmentStatus.OUT,
          ],
        },
      },
    });
    if (openExisting) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ORDER_ALREADY_SHIPPED,
        'An open shipment already exists for this order.',
        HttpStatus.CONFLICT,
      );
    }

    const priorTerminal = await this.prisma.dlvShipment.findFirst({
      where: {
        companyId,
        orderId: order.id,
        deletedAt: null,
        status: {
          in: [DlvShipmentStatus.DELIVERED, DlvShipmentStatus.FAILED],
        },
      },
      select: { id: true },
    });

    const reserveOnConfirm = await this.isReserveOnConfirm(companyId);
    /** Follow-up BL: stock was released on prior complete/fail — re-reserve remaining. */
    const needsReReserve = reserveOnConfirm && priorTerminal != null;
    if (needsReReserve) {
      try {
        for (const [productId, qty] of remainingByProduct) {
          if (qty <= 0) continue;
          await this.inventory.reserve(companyId, {
            productId,
            warehouseId: order.warehouseId,
            qty,
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Stock reserve failed.';
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.STOCK_RESERVE_FAILED,
          message,
          HttpStatus.CONFLICT,
        );
      }
    }

    let round: DlvRound | null = null;
    if (dto.roundId) {
      round = await this.findActiveRound(companyId, dto.roundId);
    }

    const driver =
      dto.driverLabel?.trim() ||
      round?.driverLabel?.trim() ||
      order.preferredDriver?.trim() ||
      null;
    const status = driver
      ? DlvShipmentStatus.ASSIGNED
      : DlvShipmentStatus.READY;
    const number = await this.nextShipmentNumber(companyId);

    let row: DlvShipment;
    try {
      row = await this.prisma.dlvShipment.create({
        data: {
          companyId,
          number,
          orderId: order.id,
          customerId: order.customerId,
          warehouseId: order.warehouseId,
          roundId: round?.id ?? null,
          status,
          driverLabel: driver,
          preferredDriver: order.preferredDriver,
          assignedAt: driver ? new Date() : null,
        },
      });
    } catch (err) {
      if (needsReReserve) {
        for (const [productId, qty] of remainingByProduct) {
          try {
            await this.inventory.release(companyId, {
              productId,
              warehouseId: order.warehouseId,
              qty,
              refType: SALES_RESERVE_REF_TYPE,
              refId: order.id,
            });
          } catch {
            // best-effort
          }
        }
      }
      throw err;
    }

    if (round && round.status === DlvRoundStatus.PLANNED) {
      await this.prisma.dlvRound.update({
        where: { id: round.id },
        data: { status: DlvRoundStatus.IN_PROGRESS, version: { increment: 1 } },
      });
    }

    return this.enrichOne(companyId, row);
  }

  async attachRound(
    companyId: string,
    id: string,
    dto: AttachRoundDto,
  ): Promise<ShipmentDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status !== DlvShipmentStatus.READY &&
      row.status !== DlvShipmentStatus.ASSIGNED
    ) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.INVALID_STATUS,
        'Round can only be attached on READY or ASSIGNED shipments.',
        HttpStatus.CONFLICT,
      );
    }
    const round = await this.findActiveRound(companyId, dto.roundId);
    const driver = row.driverLabel?.trim() || round.driverLabel;
    const updated = await this.prisma.dlvShipment.update({
      where: { id: row.id },
      data: {
        roundId: round.id,
        driverLabel: driver,
        status: driver ? DlvShipmentStatus.ASSIGNED : row.status,
        assignedAt: driver ? (row.assignedAt ?? new Date()) : row.assignedAt,
        version: { increment: 1 },
      },
    });
    if (round.status === DlvRoundStatus.PLANNED) {
      await this.prisma.dlvRound.update({
        where: { id: round.id },
        data: { status: DlvRoundStatus.IN_PROGRESS, version: { increment: 1 } },
      });
    }
    return this.enrichOne(companyId, updated);
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
    if (row.roundId) {
      await this.prisma.dlvRound.updateMany({
        where: {
          id: row.roundId,
          companyId,
          status: DlvRoundStatus.PLANNED,
          deletedAt: null,
        },
        data: { status: DlvRoundStatus.IN_PROGRESS, version: { increment: 1 } },
      });
    }
    return this.enrichOne(companyId, updated);
  }

  async complete(
    companyId: string,
    id: string,
    dto: CompleteShipmentDto = {},
  ): Promise<ShipmentDto> {
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
    const thisShipmentByLine = this.resolveDeliveredQtys(order, dto);
    const reserveOnConfirm = await this.isReserveOnConfirm(companyId);

    const issueByProduct = new Map<string, number>();
    const releaseByProduct = new Map<string, number>();
    const cumulativeByLine = new Map<string, number>();
    let amountDelivered = new Prisma.Decimal(0);

    for (const line of order.lines) {
      const already = alreadyDeliveredQty(line);
      const rem = remainingQty(line);
      const thisQty = thisShipmentByLine.get(line.id) ?? 0;
      const stillOpen = round3(rem - thisQty);
      cumulativeByLine.set(line.id, round3(already + thisQty));
      if (thisQty > 0) {
        issueByProduct.set(
          line.productId,
          round3((issueByProduct.get(line.productId) ?? 0) + thisQty),
        );
        const lineAmount = new Prisma.Decimal(thisQty)
          .mul(line.unitPrice)
          .mul(new Prisma.Decimal(1).sub(line.discountPct.div(100)));
        amountDelivered = amountDelivered.add(lineAmount);
      }
      if (stillOpen > 0) {
        releaseByProduct.set(
          line.productId,
          round3((releaseByProduct.get(line.productId) ?? 0) + stillOpen),
        );
      }
    }

    if (amountDelivered.lte(0)) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.EMPTY_DELIVERY,
        'At least one line must be delivered with qty > 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const issued: Array<{ productId: string; qty: number }> = [];
    const released: Array<{ productId: string; qty: number }> = [];

    try {
      for (const [productId, qty] of issueByProduct) {
        if (qty <= 0) continue;
        await this.inventory.issue(companyId, {
          productId,
          warehouseId: order.warehouseId,
          qty,
          refType: DELIVERY_ISSUE_REF_TYPE,
          refId: row.id,
          allocationRefType: SALES_RESERVE_REF_TYPE,
          allocationRefId: order.id,
          consumeReserved: reserveOnConfirm,
        });
        issued.push({ productId, qty });
      }
      if (reserveOnConfirm) {
        for (const [productId, qty] of releaseByProduct) {
          if (qty <= 0) continue;
          await this.inventory.release(companyId, {
            productId,
            warehouseId: order.warehouseId,
            qty,
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
          released.push({ productId, qty });
        }
      }
    } catch (err) {
      for (const r of released.reverse()) {
        try {
          await this.inventory.reserve(companyId, {
            productId: r.productId,
            warehouseId: order.warehouseId,
            qty: r.qty,
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
        } catch {
          // best-effort compensate
        }
      }
      for (const r of issued.reverse()) {
        try {
          await this.inventory.reverseIssue(companyId, {
            productId: r.productId,
            warehouseId: order.warehouseId,
            qty: r.qty,
            refType: DELIVERY_ISSUE_REF_TYPE,
            refId: row.id,
            allocationRefType: SALES_RESERVE_REF_TYPE,
            allocationRefId: order.id,
            consumeReserved: reserveOnConfirm,
          });
        } catch {
          // best-effort compensate
        }
      }
      if (err instanceof DeliveryException) throw err;
      const message =
        err instanceof Error ? err.message : 'Stock issue failed.';
      const code =
        message.toLowerCase().includes('release')
          ? DELIVERY_ERROR_CODES.STOCK_RELEASE_FAILED
          : DELIVERY_ERROR_CODES.STOCK_ISSUE_FAILED;
      throw new DeliveryException(code, message, HttpStatus.CONFLICT);
    }

    const amountRounded = round3(Number(amountDelivered.toString()));

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        const cumulative = cumulativeByLine.get(line.id) ?? 0;
        await tx.salOrderLine.update({
          where: { id: line.id },
          data: {
            deliveredQty: new Prisma.Decimal(cumulative),
            version: { increment: 1 },
          },
        });
      }

      const result = await tx.dlvShipment.updateMany({
        where: {
          id: row.id,
          companyId,
          status: { in: [row.status] },
          deletedAt: null,
        },
        data: {
          status: DlvShipmentStatus.DELIVERED,
          amountDelivered: new Prisma.Decimal(amountRounded),
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
          amountDelivered: amountRounded,
          lines: order.lines.map((l) => ({
            orderLineId: l.id,
            productId: l.productId,
            qty: thisShipmentByLine.get(l.id) ?? 0,
          })),
        },
      });
      return fresh;
    });

    await this.maybeCreateArForDelivered(
      companyId,
      order,
      amountRounded,
      updated.id,
      updated.number,
      thisShipmentByLine,
    );
    await this.maybeCloseRound(companyId, updated.roundId);

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
        const releaseByProduct = new Map<string, number>();
        for (const line of order.lines) {
          const rem = remainingQty(line);
          if (rem <= 0) continue;
          releaseByProduct.set(
            line.productId,
            round3((releaseByProduct.get(line.productId) ?? 0) + rem),
          );
        }
        for (const [productId, qty] of releaseByProduct) {
          await this.inventory.release(companyId, {
            productId,
            warehouseId: order.warehouseId,
            qty,
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

    await this.maybeCloseRound(companyId, updated.roundId);

    return this.enrichOne(companyId, updated);
  }

  private async maybeCreateArForDelivered(
    companyId: string,
    order: OrderWithLines,
    amountTotal: number,
    shipmentId: string,
    shipmentNumber: string,
    thisShipmentByLine: Map<string, number>,
  ): Promise<void> {
    const financeOn = await this.modules.isEnabled(companyId, 'finance');
    if (!financeOn) {
      return;
    }
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      return;
    }

    const productIds = [
      ...new Set(
        order.lines
          .filter((l) => (thisShipmentByLine.get(l.id) ?? 0) > 0)
          .map((l) => l.productId),
      ),
    ];
    const products =
      productIds.length > 0
        ? await this.prisma.prdProduct.findMany({
            where: {
              companyId,
              id: { in: productIds },
              deletedAt: null,
            },
            select: { id: true, name: true, sku: true },
          })
        : [];
    const nameById = new Map(
      products.map((p) => [p.id, `${p.sku} — ${p.name}`] as const),
    );

    const lines: Array<{
      description: string;
      qty: number;
      unitPriceHt: number;
      productId: string;
    }> = [];
    for (const line of order.lines) {
      const qty = round3(thisShipmentByLine.get(line.id) ?? 0);
      if (qty <= 0) continue;
      const discountFactor = new Prisma.Decimal(1).sub(
        line.discountPct.div(100),
      );
      const unitPriceHt = round3(
        Number(line.unitPrice.mul(discountFactor).toString()),
      );
      lines.push({
        description: nameById.get(line.productId) ?? `Produit ${line.productId.slice(0, 8)}`,
        qty,
        unitPriceHt,
        productId: line.productId,
      });
    }

    try {
      const result = await this.finance.ensureArForSalesOrder(companyId, {
        customerId: order.customerId,
        salesOrderId: order.id,
        amountTotal,
        orderNumber: order.number,
        currency: order.currency,
        shipmentId,
        shipmentNumber,
        lines: lines.length > 0 ? lines : undefined,
      });
      if (result.outcome === 'created') {
        this.logger.log(
          `AR open item ${result.item.number} created for order ${order.number} / ${shipmentNumber}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `AR create skipped for order ${order.number}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private resolveDeliveredQtys(
    order: OrderWithLines,
    dto: CompleteShipmentDto,
  ): Map<string, number> {
    const byLine = new Map<string, number>();
    const lineIds = new Set(order.lines.map((l) => l.id));

    if (!dto.lines) {
      for (const line of order.lines) {
        byLine.set(line.id, remainingQty(line));
      }
      return byLine;
    }

    const seen = new Set<string>();
    for (const entry of dto.lines) {
      if (!lineIds.has(entry.orderLineId)) {
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.INVALID_QTY,
          `Unknown order line ${entry.orderLineId}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (seen.has(entry.orderLineId)) {
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.INVALID_QTY,
          `Duplicate order line ${entry.orderLineId}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(entry.orderLineId);
      const line = order.lines.find((l) => l.id === entry.orderLineId)!;
      const rem = remainingQty(line);
      const qty = round3(entry.qty);
      if (!Number.isFinite(qty) || qty < 0 || qty > rem + 1e-9) {
        throw new DeliveryException(
          DELIVERY_ERROR_CODES.INVALID_QTY,
          `Delivered qty must be between 0 and remaining qty (${rem}) for line ${entry.orderLineId}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      byLine.set(entry.orderLineId, qty);
    }

    for (const line of order.lines) {
      if (!byLine.has(line.id)) {
        byLine.set(line.id, 0);
      }
    }
    return byLine;
  }

  private async maybeCloseRound(
    companyId: string,
    roundId: string | null,
  ): Promise<void> {
    if (!roundId) return;
    const open = await this.prisma.dlvShipment.count({
      where: {
        companyId,
        roundId,
        deletedAt: null,
        status: {
          in: [
            DlvShipmentStatus.READY,
            DlvShipmentStatus.ASSIGNED,
            DlvShipmentStatus.OUT,
          ],
        },
      },
    });
    if (open > 0) return;
    await this.prisma.dlvRound.updateMany({
      where: {
        id: roundId,
        companyId,
        deletedAt: null,
        status: { in: [DlvRoundStatus.PLANNED, DlvRoundStatus.IN_PROGRESS] },
      },
      data: { status: DlvRoundStatus.DONE, version: { increment: 1 } },
    });
  }

  private async findActiveRound(
    companyId: string,
    id: string,
  ): Promise<DlvRound> {
    const row = await this.prisma.dlvRound.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new DeliveryException(
        DELIVERY_ERROR_CODES.ROUND_NOT_FOUND,
        'Round not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
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
    const roundIds = [
      ...new Set(rows.map((r) => r.roundId).filter((id): id is string => !!id)),
    ];

    const [orders, customers, warehouses, rounds] = await Promise.all([
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
      roundIds.length
        ? this.prisma.dlvRound.findMany({
            where: { companyId, id: { in: roundIds }, deletedAt: null },
          })
        : Promise.resolve([] as DlvRound[]),
    ]);

    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const roundMap = new Map(rounds.map((r) => [r.id, r]));

    return rows.map((row) => {
      const customer = customerMap.get(row.customerId);
      const warehouse = warehouseMap.get(row.warehouseId);
      const order = orderMap.get(row.orderId);
      const round = row.roundId ? roundMap.get(row.roundId) : undefined;
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
        roundId: row.roundId,
        roundDate: round ? round.date.toISOString().slice(0, 10) : null,
        roundDriverLabel: round?.driverLabel ?? null,
        status: row.status,
        driverLabel: row.driverLabel,
        preferredDriver: row.preferredDriver,
        failReason: row.failReason,
        amountDelivered: row.amountDelivered?.toString() ?? null,
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
    followUpIds: Set<string>,
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
      const remainingLineCount = o.lines.filter((l) => remainingQty(l) > 0)
        .length;
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
        remainingLineCount,
        followUp: followUpIds.has(o.id),
      };
    });
  }
}

function serializeRound(row: DlvRound, shipmentCount: number): RoundDto {
  return {
    id: row.id,
    companyId: row.companyId,
    date: row.date.toISOString().slice(0, 10),
    driverLabel: row.driverLabel,
    status: row.status,
    notes: row.notes,
    version: row.version,
    shipmentCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function alreadyDeliveredQty(line: SalOrderLine): number {
  if (line.deliveredQty == null) return 0;
  return round3(Number(line.deliveredQty.toString()));
}

function remainingQty(line: SalOrderLine): number {
  const ordered = round3(Number(line.qty.toString()));
  return round3(Math.max(0, ordered - alreadyDeliveredQty(line)));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

import { HttpStatus, Injectable } from '@nestjs/common';
import {
  InvBalance,
  InvLot,
  InvLotStatus,
  InvMovementType,
  InvWarehouse,
  Prisma,
  PrdProductStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  INVENTORY_ERROR_CODES,
  INVENTORY_EVENT_TYPES,
} from './inventory.constants';
import { InventoryException } from './inventory.exception';
import type {
  AdjustLotDto,
  AdjustStockDto,
  CreateLotDto,
  CreateWarehouseDto,
  IssueStockDto,
  PatchLotStatusDto,
  ReleaseStockDto,
  ReserveStockDto,
} from './inventory.dto';

export type WarehouseDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type BalanceDto = {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  onHand: string;
  reserved: string;
  available: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type MovementDto = {
  id: string;
  companyId: string;
  balanceId: string;
  lotId: string | null;
  type: InvMovementType;
  qty: string;
  onHandAfter: string;
  reservedAfter: string;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
};

export type LotDto = {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  lotCode: string;
  qtyOnHand: string;
  qtyReserved: string;
  available: string;
  dlc: string | null;
  status: InvLotStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listWarehouses(companyId: string): Promise<{ items: WarehouseDto[] }> {
    const rows = await this.prisma.invWarehouse.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ code: 'asc' }],
    });
    return { items: rows.map(serializeWarehouse) };
  }

  async createWarehouse(
    companyId: string,
    dto: CreateWarehouseDto,
  ): Promise<WarehouseDto> {
    try {
      const row = await this.prisma.invWarehouse.create({
        data: {
          companyId,
          code: dto.code.trim(),
          name: dto.name.trim(),
        },
      });
      return serializeWarehouse(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.WAREHOUSE_DUP,
          'Warehouse code already exists for this company.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async listBalances(
    companyId: string,
    opts: { q?: string; warehouseId?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: BalanceDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.InvBalanceWhereInput = { companyId };
    if (opts.warehouseId) {
      where.warehouseId = opts.warehouseId;
    }

    let productIdsFilter: string[] | undefined;
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      const products = await this.prisma.prdProduct.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      productIdsFilter = products.map((p) => p.id);
      if (productIdsFilter.length === 0) {
        return { items: [], nextCursor: null };
      }
      where.productId = { in: productIdsFilter };
    }

    const rows = await this.prisma.invBalance.findMany({
      where,
      include: { warehouse: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;

    const productIds = [...new Set(page.map((r) => r.productId))];
    const products = await this.prisma.prdProduct.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      items: page.map((row) =>
        serializeBalance(row, row.warehouse, productMap.get(row.productId)),
      ),
      nextCursor,
    };
  }

  async listMovements(
    companyId: string,
    opts: { balanceId?: string; limit?: number } = {},
  ): Promise<{ items: MovementDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = await this.prisma.invMovement.findMany({
      where: {
        companyId,
        ...(opts.balanceId ? { balanceId: opts.balanceId } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeMovement) };
  }

  async adjust(companyId: string, dto: AdjustStockDto): Promise<BalanceDto> {
    const product = await this.assertProduct(companyId, dto.productId);
    if (product.trackLot) {
      const code = dto.lotCode?.trim();
      if (!code) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.LOT_REQUIRED,
          'lotCode required when product.trackLot is enabled.',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.adjustOrCreateLot(companyId, {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        lotCode: code,
        dlc: dto.dlc,
        qtyDelta: dto.qtyDelta,
        reason: dto.reason,
      });
      const bal = await this.prisma.invBalance.findUniqueOrThrow({
        where: {
          companyId_warehouseId_productId: {
            companyId,
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
      });
      return this.toBalanceDto(companyId, bal);
    }

    const qtyDelta = toDecimal(dto.qtyDelta);
    if (qtyDelta.isZero()) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qtyDelta must be non-zero.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, dto.warehouseId);

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );
      const onHand = bal.onHand.add(qtyDelta);
      const reserved = bal.reserved;
      this.assertAvailable(onHand, reserved);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updated.id,
          type: InvMovementType.ADJUST,
          qty: qtyDelta,
          onHandAfter: updated.onHand,
          reservedAfter: updated.reserved,
          reason: dto.reason?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'inv_balance',
        aggregateId: updated.id,
        eventType: INVENTORY_EVENT_TYPES.ADJUSTED,
        payloadJson: {
          balanceId: updated.id,
          warehouseId: updated.warehouseId,
          productId: updated.productId,
          qtyDelta: qtyDelta.toString(),
          onHand: updated.onHand.toString(),
          reserved: updated.reserved.toString(),
        },
      });

      return updated;
    });

    return this.toBalanceDto(companyId, balance);
  }

  async reserve(companyId: string, dto: ReserveStockDto): Promise<BalanceDto> {
    const qty = toDecimal(dto.qty);
    if (qty.lte(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qty must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, dto.warehouseId);
    await this.assertProduct(companyId, dto.productId);

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );
      const onHand = bal.onHand;
      const reserved = bal.reserved.add(qty);
      this.assertAvailable(onHand, reserved);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updated.id,
          type: InvMovementType.RESERVE,
          qty,
          onHandAfter: updated.onHand,
          reservedAfter: updated.reserved,
          refType: dto.refType?.trim() || null,
          refId: dto.refId?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'inv_balance',
        aggregateId: updated.id,
        eventType: INVENTORY_EVENT_TYPES.RESERVED,
        payloadJson: {
          balanceId: updated.id,
          warehouseId: updated.warehouseId,
          productId: updated.productId,
          qty: qty.toString(),
          onHand: updated.onHand.toString(),
          reserved: updated.reserved.toString(),
          refType: dto.refType ?? null,
          refId: dto.refId ?? null,
        },
      });

      return updated;
    });

    return this.toBalanceDto(companyId, balance);
  }

  async release(companyId: string, dto: ReleaseStockDto): Promise<BalanceDto> {
    const qty = toDecimal(dto.qty);
    if (qty.lte(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qty must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, dto.warehouseId);
    await this.assertProduct(companyId, dto.productId);

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );
      if (bal.reserved.lt(qty)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Cannot release more than reserved.',
          HttpStatus.CONFLICT,
        );
      }
      const onHand = bal.onHand;
      const reserved = bal.reserved.sub(qty);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updated.id,
          type: InvMovementType.RELEASE,
          qty,
          onHandAfter: updated.onHand,
          reservedAfter: updated.reserved,
          refType: dto.refType?.trim() || null,
          refId: dto.refId?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'inv_balance',
        aggregateId: updated.id,
        eventType: INVENTORY_EVENT_TYPES.RELEASED,
        payloadJson: {
          balanceId: updated.id,
          warehouseId: updated.warehouseId,
          productId: updated.productId,
          qty: qty.toString(),
          onHand: updated.onHand.toString(),
          reserved: updated.reserved.toString(),
          refType: dto.refType ?? null,
          refId: dto.refId ?? null,
        },
      });

      return updated;
    });

    return this.toBalanceDto(companyId, balance);
  }

  /** Delivery complete: decrease on_hand and reserved together. */
  async issue(companyId: string, dto: IssueStockDto): Promise<BalanceDto> {
    const qty = toDecimal(dto.qty);
    if (qty.lte(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qty must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, dto.warehouseId);
    await this.assertProduct(companyId, dto.productId);

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );
      if (bal.reserved.lt(qty) || bal.onHand.lt(qty)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Cannot issue more than reserved / on_hand.',
          HttpStatus.CONFLICT,
        );
      }
      const onHand = bal.onHand.sub(qty);
      const reserved = bal.reserved.sub(qty);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updated.id,
          type: InvMovementType.ISSUE,
          qty,
          onHandAfter: updated.onHand,
          reservedAfter: updated.reserved,
          refType: dto.refType?.trim() || null,
          refId: dto.refId?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'inv_balance',
        aggregateId: updated.id,
        eventType: INVENTORY_EVENT_TYPES.ISSUED,
        payloadJson: {
          balanceId: updated.id,
          warehouseId: updated.warehouseId,
          productId: updated.productId,
          qty: qty.toString(),
          onHand: updated.onHand.toString(),
          reserved: updated.reserved.toString(),
          refType: dto.refType ?? null,
          refId: dto.refId ?? null,
        },
      });

      return updated;
    });

    return this.toBalanceDto(companyId, balance);
  }

  async listLots(
    companyId: string,
    opts: {
      q?: string;
      warehouseId?: string;
      productId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: LotDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.InvLotWhereInput = { companyId };
    if (opts.warehouseId) where.warehouseId = opts.warehouseId;
    if (opts.productId) where.productId = opts.productId;
    if (opts.status) {
      const st = parseLotStatus(opts.status);
      if (st) where.status = st;
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      const products = await this.prisma.prdProduct.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 200,
      });
      const ids = products.map((p) => p.id);
      where.OR = [
        { lotCode: { contains: q, mode: 'insensitive' } },
        ...(ids.length ? [{ productId: { in: ids } }] : []),
      ];
    }

    const rows = await this.prisma.invLot.findMany({
      where,
      include: { warehouse: true },
      orderBy: [{ dlc: 'asc' }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1]!.id : null;
    const productIds = [...new Set(page.map((r) => r.productId))];
    const products = await this.prisma.prdProduct.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      items: page.map((row) =>
        serializeLot(row, row.warehouse, productMap.get(row.productId)),
      ),
      nextCursor,
    };
  }

  async createLot(companyId: string, dto: CreateLotDto): Promise<LotDto> {
    await this.assertWarehouse(companyId, dto.warehouseId);
    await this.assertProduct(companyId, dto.productId);
    const lotCode = dto.lotCode.trim();
    if (!lotCode) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'lotCode is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const status = parseLotStatus(dto.status) ?? InvLotStatus.OPEN;
    const initial = dto.initialQty != null ? toDecimal(dto.initialQty) : null;
    if (initial && initial.lt(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'initialQty cannot be negative.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      if (initial && !initial.isZero()) {
        return this.adjustOrCreateLot(companyId, {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          lotCode,
          dlc: dto.dlc,
          status,
          qtyDelta: Number(initial.toString()),
          reason: 'lot.create',
        });
      }

      const row = await this.prisma.invLot.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          productId: dto.productId,
          lotCode,
          dlc: parseDlc(dto.dlc),
          status,
        },
        include: { warehouse: true },
      });
      const product = await this.prisma.prdProduct.findFirst({
        where: { id: row.productId, companyId },
        select: { id: true, sku: true, name: true, uom: true },
      });
      return serializeLot(row, row.warehouse, product ?? undefined);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.LOT_DUP,
          'Lot code already exists for this product/warehouse.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  async adjustLot(companyId: string, dto: AdjustLotDto): Promise<LotDto> {
    const existing = await this.prisma.invLot.findFirst({
      where: { id: dto.lotId, companyId },
    });
    if (!existing) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.NOT_FOUND,
        'Lot not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.adjustOrCreateLot(companyId, {
      productId: existing.productId,
      warehouseId: existing.warehouseId,
      lotCode: existing.lotCode,
      lotId: existing.id,
      qtyDelta: dto.qtyDelta,
      reason: dto.reason,
    });
  }

  async patchLotStatus(
    companyId: string,
    lotId: string,
    dto: PatchLotStatusDto,
  ): Promise<LotDto> {
    const status = parseLotStatus(dto.status);
    if (!status) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'Invalid lot status.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.prisma.invLot.findFirst({
      where: { id: lotId, companyId },
    });
    if (!existing) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.NOT_FOUND,
        'Lot not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const updated = await this.prisma.invLot.update({
      where: { id: lotId },
      data: { status, version: { increment: 1 } },
      include: { warehouse: true },
    });
    const product = await this.prisma.prdProduct.findFirst({
      where: { id: updated.productId, companyId },
      select: { id: true, sku: true, name: true, uom: true },
    });
    return serializeLot(updated, updated.warehouse, product ?? undefined);
  }

  private async adjustOrCreateLot(
    companyId: string,
    input: {
      productId: string;
      warehouseId: string;
      lotCode: string;
      lotId?: string;
      dlc?: string;
      status?: InvLotStatus;
      qtyDelta: number;
      reason?: string;
    },
  ): Promise<LotDto> {
    const qtyDelta = toDecimal(input.qtyDelta);
    if (qtyDelta.isZero()) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qtyDelta must be non-zero.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, input.warehouseId);
    await this.assertProduct(companyId, input.productId);

    const lot = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        input.warehouseId,
        input.productId,
      );

      let lotRow: InvLot | null = null;
      if (input.lotId) {
        lotRow = await tx.invLot.findFirst({
          where: { id: input.lotId, companyId },
        });
      } else {
        lotRow = await tx.invLot.findUnique({
          where: {
            companyId_warehouseId_productId_lotCode: {
              companyId,
              warehouseId: input.warehouseId,
              productId: input.productId,
              lotCode: input.lotCode,
            },
          },
        });
      }

      if (!lotRow) {
        lotRow = await tx.invLot.create({
          data: {
            companyId,
            warehouseId: input.warehouseId,
            productId: input.productId,
            lotCode: input.lotCode,
            dlc: parseDlc(input.dlc),
            status: input.status ?? InvLotStatus.OPEN,
            qtyOnHand: new Prisma.Decimal(0),
            qtyReserved: new Prisma.Decimal(0),
          },
        });
      }

      if (lotRow.status === InvLotStatus.CLOSED && qtyDelta.gt(0)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.LOT_CLOSED,
          'Cannot increase a CLOSED lot — reopen or use a new lot code.',
          HttpStatus.CONFLICT,
        );
      }

      const lotOnHand = lotRow.qtyOnHand.add(qtyDelta);
      const lotReserved = lotRow.qtyReserved;
      if (lotOnHand.lt(0) || lotOnHand.sub(lotReserved).lt(0)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Insufficient lot quantity.',
          HttpStatus.CONFLICT,
        );
      }

      const balOnHand = bal.onHand.add(qtyDelta);
      const balReserved = bal.reserved;
      this.assertAvailable(balOnHand, balReserved);

      const lotUpdated = await tx.invLot.updateMany({
        where: { id: lotRow.id, version: lotRow.version },
        data: {
          qtyOnHand: lotOnHand,
          qtyReserved: lotReserved,
          ...(input.dlc !== undefined ? { dlc: parseDlc(input.dlc) } : {}),
          version: { increment: 1 },
        },
      });
      if (lotUpdated.count !== 1) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.VERSION_CONFLICT,
          'Lot changed concurrently — retry.',
          HttpStatus.CONFLICT,
        );
      }

      const updatedBal = await this.updateBalanceVersioned(tx, bal, {
        onHand: balOnHand,
        reserved: balReserved,
      });

      const freshLot = await tx.invLot.findUniqueOrThrow({
        where: { id: lotRow.id },
      });

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updatedBal.id,
          lotId: freshLot.id,
          type: InvMovementType.ADJUST,
          qty: qtyDelta,
          onHandAfter: updatedBal.onHand,
          reservedAfter: updatedBal.reserved,
          reason: input.reason?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'inv_lot',
        aggregateId: freshLot.id,
        eventType: INVENTORY_EVENT_TYPES.LOT_ADJUSTED,
        payloadJson: {
          lotId: freshLot.id,
          lotCode: freshLot.lotCode,
          balanceId: updatedBal.id,
          warehouseId: updatedBal.warehouseId,
          productId: updatedBal.productId,
          qtyDelta: qtyDelta.toString(),
          qtyOnHand: freshLot.qtyOnHand.toString(),
          onHand: updatedBal.onHand.toString(),
        },
      });

      return freshLot;
    });

    const warehouse = await this.prisma.invWarehouse.findFirstOrThrow({
      where: { id: lot.warehouseId, companyId },
    });
    const product = await this.prisma.prdProduct.findFirst({
      where: { id: lot.productId, companyId },
      select: { id: true, sku: true, name: true, uom: true },
    });
    return serializeLot(lot, warehouse, product ?? undefined);
  }

  private async assertWarehouse(companyId: string, warehouseId: string) {
    const wh = await this.prisma.invWarehouse.findFirst({
      where: { id: warehouseId, companyId, deletedAt: null, active: true },
    });
    if (!wh) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.NOT_FOUND,
        'Warehouse not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async assertProduct(
    companyId: string,
    productId: string,
  ): Promise<{ id: string; trackLot: boolean }> {
    const product = await this.prisma.prdProduct.findFirst({
      where: {
        id: productId,
        companyId,
        deletedAt: null,
        status: { in: [PrdProductStatus.ACTIVE, PrdProductStatus.DRAFT] },
      },
      select: { id: true, trackLot: true },
    });
    if (!product) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return product;
  }

  private async lockOrCreateBalance(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    productId: string,
  ): Promise<InvBalance> {
    const existing = await tx.invBalance.findUnique({
      where: {
        companyId_warehouseId_productId: {
          companyId,
          warehouseId,
          productId,
        },
      },
    });
    if (existing) return existing;

    try {
      return await tx.invBalance.create({
        data: {
          companyId,
          warehouseId,
          productId,
          onHand: new Prisma.Decimal(0),
          reserved: new Prisma.Decimal(0),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const again = await tx.invBalance.findUnique({
          where: {
            companyId_warehouseId_productId: {
              companyId,
              warehouseId,
              productId,
            },
          },
        });
        if (again) return again;
      }
      throw err;
    }
  }

  private async updateBalanceVersioned(
    tx: Prisma.TransactionClient,
    bal: InvBalance,
    next: { onHand: Prisma.Decimal; reserved: Prisma.Decimal },
  ): Promise<InvBalance> {
    const result = await tx.invBalance.updateMany({
      where: { id: bal.id, version: bal.version },
      data: {
        onHand: next.onHand,
        reserved: next.reserved,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.VERSION_CONFLICT,
        'Stock balance changed concurrently — retry.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await tx.invBalance.findUniqueOrThrow({
      where: { id: bal.id },
    });
    return updated;
  }

  private assertAvailable(onHand: Prisma.Decimal, reserved: Prisma.Decimal) {
    if (onHand.sub(reserved).lt(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INSUFFICIENT,
        'Insufficient available stock (on_hand - reserved).',
        HttpStatus.CONFLICT,
      );
    }
    if (onHand.lt(0) || reserved.lt(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INSUFFICIENT,
        'Stock quantities cannot be negative.',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async toBalanceDto(
    companyId: string,
    balance: InvBalance,
  ): Promise<BalanceDto> {
    const warehouse = await this.prisma.invWarehouse.findFirstOrThrow({
      where: { id: balance.warehouseId, companyId },
    });
    const product = await this.prisma.prdProduct.findFirst({
      where: { id: balance.productId, companyId },
      select: { id: true, sku: true, name: true, uom: true },
    });
    return serializeBalance(balance, warehouse, product ?? undefined);
  }
}

function toDecimal(n: number): Prisma.Decimal {
  if (!Number.isFinite(n)) {
    throw new InventoryException(
      INVENTORY_ERROR_CODES.INVALID_QTY,
      'Quantity must be a finite number.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return new Prisma.Decimal(n);
}

function serializeWarehouse(row: InvWarehouse): WarehouseDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeBalance(
  row: InvBalance,
  warehouse: InvWarehouse,
  product?: { sku: string; name: string; uom: string } | null,
): BalanceDto {
  const available = row.onHand.sub(row.reserved);
  return {
    id: row.id,
    companyId: row.companyId,
    warehouseId: row.warehouseId,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    productId: row.productId,
    productSku: product?.sku ?? null,
    productName: product?.name ?? null,
    productUom: product?.uom ?? null,
    onHand: row.onHand.toString(),
    reserved: row.reserved.toString(),
    available: available.toString(),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMovement(row: {
  id: string;
  companyId: string;
  balanceId: string;
  lotId?: string | null;
  type: InvMovementType;
  qty: Prisma.Decimal;
  onHandAfter: Prisma.Decimal;
  reservedAfter: Prisma.Decimal;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: Date;
}): MovementDto {
  return {
    id: row.id,
    companyId: row.companyId,
    balanceId: row.balanceId,
    lotId: row.lotId ?? null,
    type: row.type,
    qty: row.qty.toString(),
    onHandAfter: row.onHandAfter.toString(),
    reservedAfter: row.reservedAfter.toString(),
    reason: row.reason,
    refType: row.refType,
    refId: row.refId,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeLot(
  row: InvLot,
  warehouse: InvWarehouse,
  product?: { sku: string; name: string; uom: string } | null,
): LotDto {
  return {
    id: row.id,
    companyId: row.companyId,
    warehouseId: row.warehouseId,
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    productId: row.productId,
    productSku: product?.sku ?? null,
    productName: product?.name ?? null,
    productUom: product?.uom ?? null,
    lotCode: row.lotCode,
    qtyOnHand: row.qtyOnHand.toString(),
    qtyReserved: row.qtyReserved.toString(),
    available: row.qtyOnHand.sub(row.qtyReserved).toString(),
    dlc: row.dlc ? row.dlc.toISOString().slice(0, 10) : null,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function parseLotStatus(raw?: string): InvLotStatus | null {
  if (!raw?.trim()) return null;
  const key = raw.trim().toUpperCase();
  if (key === 'OPEN') return InvLotStatus.OPEN;
  if (key === 'QUARANTINE') return InvLotStatus.QUARANTINE;
  if (key === 'CLOSED') return InvLotStatus.CLOSED;
  return null;
}

function parseDlc(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  // Accept YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new InventoryException(
      INVENTORY_ERROR_CODES.INVALID_QTY,
      'dlc must be YYYY-MM-DD.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return new Date(`${s}T00:00:00.000Z`);
}

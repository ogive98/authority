import { HttpStatus, Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  InvBalance,
  InvCheeseArticle,
  InvLot,
  InvLotAllocStatus,
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
import { pickFefoSlices, sumDecimal } from './inventory.fefo';
import type {
  AdjustLotDto,
  AdjustStockDto,
  CreateLotDto,
  CreateWarehouseDto,
  IssueStockDto,
  PatchCheeseArticleDto,
  PatchLotStatusDto,
  PreviewDlcDto,
  ReleaseStockDto,
  ReserveStockDto,
  UpsertCheeseArticleDto,
} from './inventory.dto';
import { computeDlcIso, computeProductionDateIso, dailyLotCode, tunisClock } from './inventory.shelf';

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
  packDate: string | null;
  productionDate: string | null;
  dlc: string | null;
  status: InvLotStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type CheeseArticleDto = {
  id: string;
  companyId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  shelfLifeDays: number;
  active: boolean;
  notes: string | null;
  version: number;
  /** Example DLC if packed today (UTC date) — preview only. */
  sampleDlcToday: string;
  createdAt: string;
  updatedAt: string;
};

export type SalubritaCertLine = {
  productId: string;
  productSku: string;
  productName: string;
  productionDate: string;
  packDate: string;
  dlc: string;
  daysAfterPack: number;
  lotCode: string | null;
  shelfLifeDays: number;
};

const SALUBRITA_HISTORY_DAYS = 30;

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
    const product = await this.assertProduct(companyId, dto.productId);
    if (product.trackLot) {
      this.requireLotSource(dto.refType, dto.refId);
    }

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );

      if (product.trackLot) {
        const { sourceType, sourceId } = this.requireLotSource(
          dto.refType,
          dto.refId,
        );
        const existing = await this.findFefoRowsInTx(tx, {
          companyId,
          sourceType,
          sourceId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          status: [
            InvLotAllocStatus.ALLOCATED,
            InvLotAllocStatus.CONSUMED,
          ],
        });
        if (existing.length > 0) {
          return bal;
        }
      }

      const onHand = bal.onHand;
      const reserved = bal.reserved.add(qty);
      this.assertAvailable(onHand, reserved);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      if (product.trackLot) {
        await this.allocateFefoInTx(tx, companyId, dto, qty);
      }

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
    const product = await this.assertProduct(companyId, dto.productId);

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

      if (product.trackLot) {
        await this.releaseFefoInTx(tx, companyId, dto);
      }

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
    const product = await this.assertProduct(companyId, dto.productId);
    const consumeReserved = dto.consumeReserved !== false;
    if (product.trackLot) {
      this.requireLotSource(
        dto.allocationRefType ?? dto.refType,
        dto.allocationRefId ?? dto.refId,
      );
    }

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );

      if (product.trackLot && dto.refId?.trim()) {
        const already = await this.findFefoRowsInTx(tx, {
          companyId,
          consumeRefId: dto.refId.trim(),
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          status: [InvLotAllocStatus.CONSUMED],
        });
        if (already.length > 0) {
          return bal;
        }
      }

      if (consumeReserved) {
        if (bal.reserved.lt(qty) || bal.onHand.lt(qty)) {
          throw new InventoryException(
            INVENTORY_ERROR_CODES.INSUFFICIENT,
            'Cannot issue more than reserved / on_hand.',
            HttpStatus.CONFLICT,
          );
        }
      } else if (bal.onHand.lt(qty)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Cannot issue more than on_hand.',
          HttpStatus.CONFLICT,
        );
      }
      const onHand = bal.onHand.sub(qty);
      const reserved = consumeReserved ? bal.reserved.sub(qty) : bal.reserved;
      this.assertAvailable(onHand, reserved);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      if (product.trackLot) {
        await this.consumeFefoInTx(tx, companyId, dto, qty);
      }

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

  /** Undo a delivery issue (SKU + lots) without FEFO re-pick. */
  async reverseIssue(
    companyId: string,
    dto: IssueStockDto,
  ): Promise<BalanceDto> {
    const qty = toDecimal(dto.qty);
    if (qty.lte(0)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qty must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertWarehouse(companyId, dto.warehouseId);
    const product = await this.assertProduct(companyId, dto.productId);
    const consumeReserved = dto.consumeReserved !== false;

    const balance = await this.prisma.$transaction(async (tx) => {
      const bal = await this.lockOrCreateBalance(
        tx,
        companyId,
        dto.warehouseId,
        dto.productId,
      );
      const onHand = bal.onHand.add(qty);
      const reserved = consumeReserved ? bal.reserved.add(qty) : bal.reserved;
      this.assertAvailable(onHand, reserved);

      const updated = await this.updateBalanceVersioned(tx, bal, {
        onHand,
        reserved,
      });

      if (product.trackLot) {
        await this.reverseFefoInTx(tx, companyId, dto);
      }

      await tx.invMovement.create({
        data: {
          companyId,
          balanceId: updated.id,
          type: InvMovementType.ADJUST,
          qty,
          onHandAfter: updated.onHand,
          reservedAfter: updated.reserved,
          reason: 'reverse issue',
          refType: dto.refType?.trim() || null,
          refId: dto.refId?.trim() || null,
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

  async listCheeseArticles(
    companyId: string,
    opts: { activeOnly?: boolean } = {},
  ): Promise<{ items: CheeseArticleDto[] }> {
    const rows = await this.prisma.invCheeseArticle.findMany({
      where: {
        companyId,
        ...(opts.activeOnly === undefined ? {} : { active: opts.activeOnly }),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const products = await this.prisma.prdProduct.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const today = new Date().toISOString().slice(0, 10);
    return {
      items: rows.map((row) =>
        serializeCheeseArticle(row, productMap.get(row.productId), today),
      ),
    };
  }

  async upsertCheeseArticle(
    companyId: string,
    dto: UpsertCheeseArticleDto,
  ): Promise<CheeseArticleDto> {
    const shelfLifeDays = Math.trunc(Number(dto.shelfLifeDays));
    if (!Number.isFinite(shelfLifeDays) || shelfLifeDays < 1) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
        'shelfLifeDays must be a positive integer (ex. 7, 30, 60).',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertProduct(companyId, dto.productId);

    const existing = await this.prisma.invCheeseArticle.findUnique({
      where: {
        companyId_productId: {
          companyId,
          productId: dto.productId,
        },
      },
    });

    const row = existing
      ? await this.prisma.invCheeseArticle.update({
          where: { id: existing.id },
          data: {
            shelfLifeDays,
            active: dto.active ?? existing.active,
            notes:
              dto.notes !== undefined
                ? dto.notes.trim() || null
                : existing.notes,
            version: { increment: 1 },
          },
        })
      : await this.prisma.invCheeseArticle.create({
          data: {
            companyId,
            productId: dto.productId,
            shelfLifeDays,
            active: dto.active ?? true,
            notes: dto.notes?.trim() || null,
          },
        });

    await this.prisma.prdProduct.updateMany({
      where: { id: dto.productId, companyId },
      data: { trackLot: true, shelfLifeDays, perishable: true },
    });

    const product = await this.prisma.prdProduct.findFirst({
      where: { id: row.productId, companyId },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const today = new Date().toISOString().slice(0, 10);
    return serializeCheeseArticle(row, product ?? undefined, today);
  }

  async patchCheeseArticle(
    companyId: string,
    id: string,
    dto: PatchCheeseArticleDto,
  ): Promise<CheeseArticleDto> {
    const existing = await this.prisma.invCheeseArticle.findFirst({
      where: { id, companyId },
    });
    if (!existing) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.ARTICLE_NOT_FOUND,
        'Cheese article not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    let shelfLifeDays = existing.shelfLifeDays;
    if (dto.shelfLifeDays !== undefined) {
      shelfLifeDays = Math.trunc(Number(dto.shelfLifeDays));
      if (!Number.isFinite(shelfLifeDays) || shelfLifeDays < 1) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
          'shelfLifeDays must be a positive integer (ex. 7, 30, 60).',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const row = await this.prisma.invCheeseArticle.update({
      where: { id: existing.id },
      data: {
        shelfLifeDays,
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes.trim() || null }
          : {}),
        version: { increment: 1 },
      },
    });

    await this.prisma.prdProduct.updateMany({
      where: { id: row.productId, companyId },
      data: {
        shelfLifeDays,
        trackLot: true,
        perishable: true,
      },
    });

    const product = await this.prisma.prdProduct.findFirst({
      where: { id: row.productId, companyId },
      select: { id: true, sku: true, name: true, uom: true },
    });
    const today = new Date().toISOString().slice(0, 10);
    return serializeCheeseArticle(row, product ?? undefined, today);
  }

  previewDlc(dto: PreviewDlcDto): { packDate: string; dlc: string } {
    try {
      const shelfLifeDays = Math.trunc(Number(dto.shelfLifeDays));
      const dlc = computeDlcIso(dto.packDate, shelfLifeDays);
      return { packDate: dto.packDate.trim(), dlc };
    } catch (err) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
        err instanceof Error ? err.message : 'Invalid packDate / shelfLifeDays.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * D102 — one OPEN lot per ACTIVE product with shelfLifeDays for packDate (Tunis day).
   * Idempotent on lotCode = SKU-YYYYMMDD.
   */
  async generateDailyCheeseLots(
    companyId: string,
    opts: { packDate?: string; warehouseId?: string } = {},
  ): Promise<{
    packDate: string;
    warehouseId: string;
    created: number;
    skipped: number;
    items: Array<{ lotCode: string; productSku: string; dlc: string; status: 'created' | 'skipped' }>;
  }> {
    const packDate = (opts.packDate?.trim() || tunisClock().date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(packDate)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
        'packDate must be YYYY-MM-DD.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let warehouseId = opts.warehouseId?.trim();
    if (warehouseId) {
      await this.assertWarehouse(companyId, warehouseId);
    } else {
      const main = await this.prisma.invWarehouse.findFirst({
        where: { companyId, code: 'MAIN', deletedAt: null, active: true },
      });
      if (!main) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.NOT_FOUND,
          'MAIN warehouse not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      warehouseId = main.id;
    }

    const products = await this.prisma.prdProduct.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: PrdProductStatus.ACTIVE,
        shelfLifeDays: { not: null, gt: 0 },
      },
      orderBy: [{ sku: 'asc' }],
      select: {
        id: true,
        sku: true,
        name: true,
        uom: true,
        shelfLifeDays: true,
        productionOffsetDays: true,
      },
    });

    let created = 0;
    let skipped = 0;
    const items: Array<{
      lotCode: string;
      productSku: string;
      dlc: string;
      status: 'created' | 'skipped';
    }> = [];

    for (const product of products) {
      const shelfLifeDays = product.shelfLifeDays;
      if (shelfLifeDays == null || shelfLifeDays < 1) continue;
      const lotCode = dailyLotCode(product.sku, packDate);
      const dlcIso = computeDlcIso(packDate, shelfLifeDays);
      const productionIso = computeProductionDateIso(
        packDate,
        product.productionOffsetDays,
      );
      const existing = await this.prisma.invLot.findUnique({
        where: {
          companyId_warehouseId_productId_lotCode: {
            companyId,
            warehouseId,
            productId: product.id,
            lotCode,
          },
        },
      });
      if (existing) {
        skipped += 1;
        items.push({
          lotCode,
          productSku: product.sku,
          dlc: dlcIso,
          status: 'skipped',
        });
        continue;
      }

      await this.prisma.invLot.create({
        data: {
          companyId,
          warehouseId,
          productId: product.id,
          lotCode,
          packDate: parseDlc(packDate),
          productionDate: parseDlc(productionIso),
          dlc: parseDlc(dlcIso),
          status: InvLotStatus.OPEN,
          qtyOnHand: new Prisma.Decimal(0),
          qtyReserved: new Prisma.Decimal(0),
        },
      });
      await this.prisma.prdProduct.updateMany({
        where: { id: product.id, companyId },
        data: { trackLot: true },
      });
      created += 1;
      items.push({
        lotCode,
        productSku: product.sku,
        dlc: dlcIso,
        status: 'created',
      });
    }

    const cert = await this.buildSalubritaCertificateLive(companyId, {
      packDate,
      warehouseId,
    });
    if (cert.items.length > 0) {
      try {
        await this.upsertSalubritaSnapshot(
          companyId,
          packDate,
          warehouseId,
          cert.items,
        );
      } catch {
        // best-effort publish snapshot
      }
    }

    return { packDate, warehouseId, created, skipped, items };
  }

  /**
   * D105 — last 30 calendar days of certificat snapshots (+ backfill from live).
   */
  async listSalubritaHistory(
    companyId: string,
  ): Promise<{
    days: number;
    fromDate: string;
    toDate: string;
    items: Array<{
      packDate: string;
      lineCount: number;
      updatedAt: string;
      source: 'snapshot' | 'live';
    }>;
  }> {
    const toDate = tunisClock().date;
    const fromDate = addDaysIso(toDate, -(SALUBRITA_HISTORY_DAYS - 1));
    const from = parseDlc(fromDate);
    const to = parseDlc(toDate);
    if (!from || !to) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
        'Invalid history date window.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const snaps = await this.prisma.invSalubritaCertificate.findMany({
      where: {
        companyId,
        packDate: { gte: from, lte: to },
      },
      orderBy: [{ packDate: 'desc' }],
      select: {
        packDate: true,
        lineCount: true,
        updatedAt: true,
      },
    });
    const byDate = new Map<
      string,
      {
        packDate: string;
        lineCount: number;
        updatedAt: string;
        source: 'snapshot' | 'live';
      }
    >(
      snaps.map((s) => [
        s.packDate.toISOString().slice(0, 10),
        {
          packDate: s.packDate.toISOString().slice(0, 10),
          lineCount: s.lineCount,
          updatedAt: s.updatedAt.toISOString(),
          source: 'snapshot',
        },
      ]),
    );

    // Include pack dates that have cheese lots but no snapshot yet
    const lotDates = await this.prisma.invLot.findMany({
      where: {
        companyId,
        AND: [
          { packDate: { not: null } },
          { packDate: { gte: from, lte: to } },
        ],
      },
      select: { packDate: true },
      distinct: ['packDate'],
    });
    for (const row of lotDates) {
      if (!row.packDate) continue;
      const iso = row.packDate.toISOString().slice(0, 10);
      if (byDate.has(iso)) continue;
      byDate.set(iso, {
        packDate: iso,
        lineCount: 0,
        updatedAt: new Date().toISOString(),
        source: 'live',
      });
    }

    // Always surface today
    if (!byDate.has(toDate)) {
      byDate.set(toDate, {
        packDate: toDate,
        lineCount: 0,
        updatedAt: new Date().toISOString(),
        source: 'live',
      });
    }

    const items = [...byDate.values()].sort((a, b) =>
      a.packDate < b.packDate ? 1 : a.packDate > b.packDate ? -1 : 0,
    );

    return {
      days: SALUBRITA_HISTORY_DAYS,
      fromDate,
      toDate,
      items,
    };
  }

  /**
   * D107 — customers eligible for salubrité send (flags on fiche client).
   */
  async listSalubritaRecipients(
    companyId: string,
    opts: { channel?: 'email' | 'whatsapp' | 'portal'; q?: string } = {},
  ): Promise<{
    channel: string;
    items: Array<{
      id: string;
      code: string;
      legalName: string;
      nickname: string | null;
      email: string | null;
      whatsapp: string | null;
      salubritaEmail: boolean;
      salubritaWhatsapp: boolean;
      salubritaPortal: boolean;
    }>;
  }> {
    const channel = opts.channel ?? 'email';
    const where: Prisma.CusCustomerWhereInput = {
      companyId,
      deletedAt: null,
      status: 'ACTIVE',
      blocked: false,
    };
    if (channel === 'email') where.salubritaEmail = true;
    if (channel === 'whatsapp') where.salubritaWhatsapp = true;
    if (channel === 'portal') where.salubritaPortal = true;
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
        { party: { legalName: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.cusCustomer.findMany({
      where,
      include: {
        party: true,
        contacts: {
          where: { deletedAt: null, active: true },
          orderBy: [{ createdAt: 'asc' }],
          take: 5,
        },
      },
      orderBy: [{ code: 'asc' }],
      take: 200,
    });

    const items = rows.map((row) => {
      const contactEmail =
        row.contacts.find((c) => c.email?.trim())?.email?.trim() ?? null;
      const contactWa =
        row.contacts.find((c) => c.whatsapp?.trim())?.whatsapp?.trim() ??
        row.contacts.find((c) => c.phone?.trim())?.phone?.trim() ??
        null;
      return {
        id: row.id,
        code: row.code,
        legalName: row.party.legalName,
        nickname: row.nickname,
        email: contactEmail,
        whatsapp: contactWa,
        salubritaEmail: row.salubritaEmail,
        salubritaWhatsapp: row.salubritaWhatsapp,
        salubritaPortal: row.salubritaPortal,
      };
    });

    return { channel, items };
  }

  /** Absolute path to committed OOXML template (D128). */
  resolveSalubritaTemplatePath(): string {
    const candidates = [
      join(process.cwd(), 'assets', 'salubrita', 'template.zip'),
      join(
        process.cwd(),
        'apps',
        'api',
        'assets',
        'salubrita',
        'template.zip',
      ),
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    throw new InventoryException(
      INVENTORY_ERROR_CODES.NOT_FOUND,
      'Salubrita Word template missing on server.',
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * D102/D105 — certificate for packDate. Prefer snapshot for past days; refresh+save today.
   */
  async listSalubritaCertificate(
    companyId: string,
    opts: {
      packDate?: string;
      warehouseId?: string;
      persist?: boolean;
    } = {},
  ): Promise<{
    packDate: string;
    warehouseId: string | null;
    source: 'snapshot' | 'live';
    items: SalubritaCertLine[];
  }> {
    const packDate = (opts.packDate?.trim() || tunisClock().date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(packDate)) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_SHELF_LIFE,
        'packDate must be YYYY-MM-DD.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const today = tunisClock().date;
    const oldest = addDaysIso(today, -(SALUBRITA_HISTORY_DAYS - 1));
    if (packDate < oldest || packDate > today) {
      // Still allow read of snapshot outside window if exists
      const snapOnly = await this.prisma.invSalubritaCertificate.findUnique({
        where: {
          companyId_packDate: {
            companyId,
            packDate: parseDlc(packDate)!,
          },
        },
      });
      if (!snapOnly) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.NOT_FOUND,
          `Certificat hors fenêtre ${SALUBRITA_HISTORY_DAYS} j.`,
          HttpStatus.NOT_FOUND,
        );
      }
      return {
        packDate,
        warehouseId: snapOnly.warehouseId,
        source: 'snapshot',
        items: asCertLines(snapOnly.payloadJson),
      };
    }

    if (packDate < today) {
      const snap = await this.prisma.invSalubritaCertificate.findUnique({
        where: {
          companyId_packDate: {
            companyId,
            packDate: parseDlc(packDate)!,
          },
        },
      });
      if (snap && asCertLines(snap.payloadJson).length > 0) {
        return {
          packDate,
          warehouseId: snap.warehouseId,
          source: 'snapshot',
          items: asCertLines(snap.payloadJson),
        };
      }
    }

    const live = await this.buildSalubritaCertificateLive(companyId, {
      packDate,
      warehouseId: opts.warehouseId,
    });

    const shouldPersist =
      opts.persist !== false &&
      (packDate === today || live.items.length > 0);
    if (shouldPersist && live.items.length > 0) {
      try {
        await this.upsertSalubritaSnapshot(
          companyId,
          live.packDate,
          live.warehouseId,
          live.items,
        );
      } catch {
        // Snapshot is best-effort — never block consultation / print / send
      }
    }

    return { ...live, source: 'live' };
  }

  private async buildSalubritaCertificateLive(
    companyId: string,
    opts: { packDate: string; warehouseId?: string },
  ): Promise<{
    packDate: string;
    warehouseId: string | null;
    items: SalubritaCertLine[];
  }> {
    const packDate = opts.packDate;

    let warehouseId = opts.warehouseId?.trim() || null;
    if (warehouseId) {
      await this.assertWarehouse(companyId, warehouseId);
    } else {
      const main = await this.prisma.invWarehouse.findFirst({
        where: { companyId, code: 'MAIN', deletedAt: null, active: true },
      });
      warehouseId = main?.id ?? null;
    }

    const products = await this.prisma.prdProduct.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: PrdProductStatus.ACTIVE,
        shelfLifeDays: { not: null, gt: 0 },
      },
      orderBy: [{ sku: 'asc' }],
      select: {
        id: true,
        sku: true,
        name: true,
        shelfLifeDays: true,
        productionOffsetDays: true,
      },
    });

    const productIds = products.map((p) => p.id);
    const lots =
      warehouseId && productIds.length
        ? await this.prisma.invLot.findMany({
            where: {
              companyId,
              warehouseId,
              productId: { in: productIds },
              packDate: parseDlc(packDate)!,
            },
            select: {
              productId: true,
              lotCode: true,
              packDate: true,
              productionDate: true,
              dlc: true,
            },
          })
        : [];
    const lotByProduct = new Map(lots.map((l) => [l.productId, l]));

    const items = products.map((p) => {
      const shelf = p.shelfLifeDays!;
      const lot = lotByProduct.get(p.id);
      const dlcIso = lot?.dlc
        ? lot.dlc.toISOString().slice(0, 10)
        : computeDlcIso(packDate, shelf);
      const productionIso = lot?.productionDate
        ? lot.productionDate.toISOString().slice(0, 10)
        : computeProductionDateIso(packDate, p.productionOffsetDays);
      return {
        productId: p.id,
        productSku: p.sku,
        productName: p.name,
        productionDate: productionIso,
        packDate,
        dlc: dlcIso,
        daysAfterPack: shelf,
        lotCode: lot?.lotCode ?? dailyLotCode(p.sku, packDate),
        shelfLifeDays: shelf,
      };
    });

    return { packDate, warehouseId, items };
  }

  private async upsertSalubritaSnapshot(
    companyId: string,
    packDate: string,
    warehouseId: string | null,
    items: SalubritaCertLine[],
  ): Promise<void> {
    const pack = parseDlc(packDate);
    if (!pack) return;
    await this.prisma.invSalubritaCertificate.upsert({
      where: {
        companyId_packDate: {
          companyId,
          packDate: pack,
        },
      },
      create: {
        companyId,
        packDate: pack,
        warehouseId,
        lineCount: items.length,
        payloadJson: items,
      },
      update: {
        warehouseId,
        lineCount: items.length,
        payloadJson: items,
        version: { increment: 1 },
      },
    });
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

  private requireLotSource(
    refType?: string,
    refId?: string,
  ): { sourceType: string; sourceId: string } {
    const sourceType = refType?.trim();
    const sourceId = refId?.trim();
    if (!sourceType || !sourceId) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.LOT_SOURCE_REQUIRED,
        'refType/refId required to pick or consume lots (prevents double FEFO).',
        HttpStatus.BAD_REQUEST,
      );
    }
    return { sourceType, sourceId };
  }

  private async findFefoRowsInTx(
    tx: Prisma.TransactionClient,
    where: {
      companyId: string;
      productId: string;
      warehouseId: string;
      status: InvLotAllocStatus[];
      sourceType?: string;
      sourceId?: string;
      consumeRefId?: string;
    },
  ) {
    return tx.invLotAllocation.findMany({
      where: {
        companyId: where.companyId,
        productId: where.productId,
        warehouseId: where.warehouseId,
        status: { in: where.status },
        ...(where.sourceType ? { sourceType: where.sourceType } : {}),
        ...(where.sourceId ? { sourceId: where.sourceId } : {}),
        ...(where.consumeRefId ? { consumeRefId: where.consumeRefId } : {}),
      },
    });
  }

  private async allocateFefoInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: ReserveStockDto,
    qty: Prisma.Decimal,
  ): Promise<void> {
    const { sourceType, sourceId } = this.requireLotSource(
      dto.refType,
      dto.refId,
    );
    const existing = await tx.invLotAllocation.findMany({
      where: {
        companyId,
        sourceType,
        sourceId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        status: {
          in: [InvLotAllocStatus.ALLOCATED, InvLotAllocStatus.CONSUMED],
        },
      },
    });
    if (existing.length > 0) {
      return;
    }

    const lots = await tx.invLot.findMany({
      where: {
        companyId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        status: InvLotStatus.OPEN,
      },
      orderBy: [
        { dlc: { sort: 'asc', nulls: 'last' } },
        { lotCode: 'asc' },
      ],
    });
    const slices = pickFefoSlices(lots, qty);
    if (!slices) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INSUFFICIENT,
        'Insufficient OPEN lot quantity for FEFO reserve.',
        HttpStatus.CONFLICT,
      );
    }

    for (const slice of slices) {
      const lotRow = lots.find((l) => l.id === slice.lotId);
      if (!lotRow) continue;
      const nextReserved = lotRow.qtyReserved.add(slice.qty);
      await this.updateLotVersioned(tx, lotRow, {
        qtyOnHand: lotRow.qtyOnHand,
        qtyReserved: nextReserved,
      });
      lotRow.qtyReserved = nextReserved;
      lotRow.version += 1;
      await tx.invLotAllocation.create({
        data: {
          companyId,
          lotId: slice.lotId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          qty: slice.qty,
          status: InvLotAllocStatus.ALLOCATED,
          fromReserve: true,
          sourceType,
          sourceId,
        },
      });
    }
  }

  private async releaseFefoInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: ReleaseStockDto,
  ): Promise<void> {
    const sourceType = dto.refType?.trim();
    const sourceId = dto.refId?.trim();
    if (!sourceType || !sourceId) return;

    const allocated = await tx.invLotAllocation.findMany({
      where: {
        companyId,
        sourceType,
        sourceId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        status: InvLotAllocStatus.ALLOCATED,
      },
    });
    for (const row of allocated) {
      const lotRow = await tx.invLot.findFirst({
        where: { id: row.lotId, companyId },
      });
      if (!lotRow) continue;
      const nextReserved = lotRow.qtyReserved.sub(row.qty);
      if (nextReserved.lt(0)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Cannot release more lot qty than reserved.',
          HttpStatus.CONFLICT,
        );
      }
      await this.updateLotVersioned(tx, lotRow, {
        qtyOnHand: lotRow.qtyOnHand,
        qtyReserved: nextReserved,
      });
      await tx.invLotAllocation.update({
        where: { id: row.id },
        data: {
          status: InvLotAllocStatus.RELEASED,
          version: { increment: 1 },
        },
      });
    }
  }

  private async consumeFefoInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: IssueStockDto,
    qty: Prisma.Decimal,
  ): Promise<void> {
    const consumeRefType = dto.refType?.trim() || null;
    const consumeRefId = dto.refId?.trim() || null;
    const { sourceType, sourceId } = this.requireLotSource(
      dto.allocationRefType ?? dto.refType,
      dto.allocationRefId ?? dto.refId,
    );

    if (consumeRefId) {
      const already = await tx.invLotAllocation.findMany({
        where: {
          companyId,
          consumeRefId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          status: InvLotAllocStatus.CONSUMED,
        },
      });
      if (already.length > 0) {
        return;
      }
    }

    const allocated = await tx.invLotAllocation.findMany({
      where: {
        companyId,
        sourceType,
        sourceId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        status: InvLotAllocStatus.ALLOCATED,
      },
    });
    if (allocated.length > 0) {
      const allocatedQty = sumDecimal(allocated.map((a) => a.qty));
      if (!allocatedQty.eq(qty)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'FEFO allocation qty does not match issue qty.',
          HttpStatus.CONFLICT,
        );
      }
      for (const row of allocated) {
        const lotRow = await tx.invLot.findFirst({
          where: { id: row.lotId, companyId },
        });
        if (!lotRow) {
          throw new InventoryException(
            INVENTORY_ERROR_CODES.NOT_FOUND,
            'Allocated lot not found.',
            HttpStatus.NOT_FOUND,
          );
        }
        const nextOnHand = lotRow.qtyOnHand.sub(row.qty);
        const nextReserved = lotRow.qtyReserved.sub(row.qty);
        if (nextOnHand.lt(0) || nextReserved.lt(0)) {
          throw new InventoryException(
            INVENTORY_ERROR_CODES.INSUFFICIENT,
            'Insufficient allocated lot quantity.',
            HttpStatus.CONFLICT,
          );
        }
        await this.updateLotVersioned(tx, lotRow, {
          qtyOnHand: nextOnHand,
          qtyReserved: nextReserved,
        });
        await tx.invLotAllocation.update({
          where: { id: row.id },
          data: {
            status: InvLotAllocStatus.CONSUMED,
            consumeRefType,
            consumeRefId,
            version: { increment: 1 },
          },
        });
      }
      return;
    }

    const lots = await tx.invLot.findMany({
      where: {
        companyId,
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        status: InvLotStatus.OPEN,
      },
      orderBy: [
        { dlc: { sort: 'asc', nulls: 'last' } },
        { lotCode: 'asc' },
      ],
    });
    const slices = pickFefoSlices(lots, qty);
    if (!slices) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INSUFFICIENT,
        'Insufficient OPEN lot quantity for FEFO issue.',
        HttpStatus.CONFLICT,
      );
    }
    for (const slice of slices) {
      const lotRow = lots.find((l) => l.id === slice.lotId);
      if (!lotRow) continue;
      const nextOnHand = lotRow.qtyOnHand.sub(slice.qty);
      if (nextOnHand.lt(0) || nextOnHand.sub(lotRow.qtyReserved).lt(0)) {
        throw new InventoryException(
          INVENTORY_ERROR_CODES.INSUFFICIENT,
          'Insufficient lot quantity for FEFO issue.',
          HttpStatus.CONFLICT,
        );
      }
      await this.updateLotVersioned(tx, lotRow, {
        qtyOnHand: nextOnHand,
        qtyReserved: lotRow.qtyReserved,
      });
      lotRow.qtyOnHand = nextOnHand;
      lotRow.version += 1;
      await tx.invLotAllocation.create({
        data: {
          companyId,
          lotId: slice.lotId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          qty: slice.qty,
          status: InvLotAllocStatus.CONSUMED,
          fromReserve: false,
          sourceType,
          sourceId,
          consumeRefType,
          consumeRefId,
        },
      });
    }
  }

  private async reverseFefoInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: IssueStockDto,
  ): Promise<void> {
    const consumeRefId = dto.refId?.trim();
    if (!consumeRefId) return;

    const consumed = await tx.invLotAllocation.findMany({
      where: {
        companyId,
        consumeRefId,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        status: InvLotAllocStatus.CONSUMED,
      },
    });
    for (const row of consumed) {
      const lotRow = await tx.invLot.findFirst({
        where: { id: row.lotId, companyId },
      });
      if (!lotRow) continue;
      const nextOnHand = lotRow.qtyOnHand.add(row.qty);
      const nextReserved = row.fromReserve
        ? lotRow.qtyReserved.add(row.qty)
        : lotRow.qtyReserved;
      await this.updateLotVersioned(tx, lotRow, {
        qtyOnHand: nextOnHand,
        qtyReserved: nextReserved,
      });
      await tx.invLotAllocation.update({
        where: { id: row.id },
        data: {
          status: row.fromReserve
            ? InvLotAllocStatus.ALLOCATED
            : InvLotAllocStatus.RELEASED,
          consumeRefType: row.fromReserve ? null : row.consumeRefType,
          consumeRefId: row.fromReserve ? null : row.consumeRefId,
          version: { increment: 1 },
        },
      });
    }
  }

  private async updateLotVersioned(
    tx: Prisma.TransactionClient,
    lot: InvLot,
    next: { qtyOnHand: Prisma.Decimal; qtyReserved: Prisma.Decimal },
  ): Promise<InvLot> {
    const result = await tx.invLot.updateMany({
      where: { id: lot.id, version: lot.version },
      data: {
        qtyOnHand: next.qtyOnHand,
        qtyReserved: next.qtyReserved,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.VERSION_CONFLICT,
        'Lot changed concurrently — retry.',
        HttpStatus.CONFLICT,
      );
    }
    return tx.invLot.findUniqueOrThrow({ where: { id: lot.id } });
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

function serializeCheeseArticle(
  row: InvCheeseArticle,
  product: { sku: string; name: string; uom: string } | undefined,
  todayIso: string,
): CheeseArticleDto {
  return {
    id: row.id,
    companyId: row.companyId,
    productId: row.productId,
    productSku: product?.sku ?? null,
    productName: product?.name ?? null,
    productUom: product?.uom ?? null,
    shelfLifeDays: row.shelfLifeDays,
    active: row.active,
    notes: row.notes,
    version: row.version,
    sampleDlcToday: computeDlcIso(todayIso, row.shelfLifeDays),
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
    packDate: row.packDate ? row.packDate.toISOString().slice(0, 10) : null,
    productionDate: row.productionDate
      ? row.productionDate.toISOString().slice(0, 10)
      : null,
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

function addDaysIso(iso: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) throw new Error('date must be YYYY-MM-DD');
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const next = new Date(utc + deltaDays * 86400000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function asCertLines(payload: Prisma.JsonValue): SalubritaCertLine[] {
  if (!Array.isArray(payload)) return [];
  const out: SalubritaCertLine[] = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.productSku !== 'string' || typeof r.productName !== 'string') {
      continue;
    }
    out.push({
      productId: typeof r.productId === 'string' ? r.productId : '',
      productSku: r.productSku,
      productName: r.productName,
      productionDate:
        typeof r.productionDate === 'string' ? r.productionDate : '',
      packDate: typeof r.packDate === 'string' ? r.packDate : '',
      dlc: typeof r.dlc === 'string' ? r.dlc : '',
      daysAfterPack:
        typeof r.daysAfterPack === 'number' ? r.daysAfterPack : 0,
      lotCode: typeof r.lotCode === 'string' ? r.lotCode : null,
      shelfLifeDays:
        typeof r.shelfLifeDays === 'number' ? r.shelfLifeDays : 0,
    });
  }
  return out;
}

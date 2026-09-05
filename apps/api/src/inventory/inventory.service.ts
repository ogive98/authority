import { HttpStatus, Injectable } from '@nestjs/common';
import {
  InvBalance,
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
  AdjustStockDto,
  CreateWarehouseDto,
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
  type: InvMovementType;
  qty: string;
  onHandAfter: string;
  reservedAfter: string;
  reason: string | null;
  refType: string | null;
  refId: string | null;
  createdAt: string;
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
    const qtyDelta = toDecimal(dto.qtyDelta);
    if (qtyDelta.isZero()) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.INVALID_QTY,
        'qtyDelta must be non-zero.',
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

  private async assertProduct(companyId: string, productId: string) {
    const product = await this.prisma.prdProduct.findFirst({
      where: {
        id: productId,
        companyId,
        deletedAt: null,
        status: { in: [PrdProductStatus.ACTIVE, PrdProductStatus.DRAFT] },
      },
    });
    if (!product) {
      throw new InventoryException(
        INVENTORY_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found.',
        HttpStatus.NOT_FOUND,
      );
    }
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

import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProdWoStatus,
  PrdProductStatus,
  type ProdWorkOrder,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { InventoryException } from '../inventory/inventory.exception';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCTION_ERROR_CODES,
  PRODUCTION_EVENT_TYPES,
} from './production.constants';
import type {
  CreateWorkOrderDto,
  DeclareWorkOrderDto,
} from './production.dto';
import { ProductionException } from './production.exception';

export type WorkOrderDto = {
  id: string;
  companyId: string;
  number: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  plannedQty: string;
  actualQty: string | null;
  lotOut: string | null;
  status: ProdWoStatus;
  notes: string | null;
  version: number;
  yieldRatio: string | null;
  consumptions: Array<{
    id: string;
    productId: string;
    qty: string;
    lotIn: string | null;
    postedAt: string;
  }>;
  outputs: Array<{
    id: string;
    productId: string;
    qty: string;
    lotOut: string | null;
    postedAt: string;
  }>;
  scraps: Array<{
    id: string;
    productId: string;
    qty: string;
    reason: string | null;
    postedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ProductionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { q?: string; status?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: WorkOrderDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const status = opts.status?.trim().toUpperCase();

    const where: Prisma.ProdWorkOrderWhereInput = {
      companyId,
      deletedAt: null,
      ...(status &&
      Object.values(ProdWoStatus).includes(status as ProdWoStatus)
        ? { status: status as ProdWoStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { lotOut: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.prodWorkOrder.findMany({
      where,
      include: {
        consumptions: true,
        outputs: true,
        scraps: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return {
      items: await Promise.all(page.map((r) => this.toDto(companyId, r))),
      nextCursor,
    };
  }

  async get(companyId: string, id: string): Promise<WorkOrderDto> {
    const row = await this.findActive(companyId, id);
    return this.toDto(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateWorkOrderDto,
  ): Promise<WorkOrderDto> {
    const plannedQty = toDecimal(dto.plannedQty);
    if (plannedQty.lte(0)) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_QTY,
        'plannedQty must be positive.',
      );
    }

    await this.assertProduct(companyId, dto.productId);
    await this.assertWarehouse(companyId, dto.warehouseId);

    const number = await this.nextNumber(companyId);

    const row = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.prodWorkOrder.create({
        data: {
          companyId,
          number,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          plannedQty,
          lotOut: dto.lotOut?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: ProdWoStatus.PLANNED,
        },
        include: {
          consumptions: true,
          outputs: true,
          scraps: true,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_wo',
        aggregateId: wo.id,
        eventType: PRODUCTION_EVENT_TYPES.WO_CREATED,
        payloadJson: {
          workOrderId: wo.id,
          number: wo.number,
          productId: wo.productId,
          warehouseId: wo.warehouseId,
          plannedQty: plannedQty.toString(),
        },
      });

      return wo;
    });

    return this.toDto(companyId, row);
  }

  async release(companyId: string, id: string): Promise<WorkOrderDto> {
    const current = await this.findActive(companyId, id);
    if (current.status !== ProdWoStatus.PLANNED) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Only PLANNED work orders can be released.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.prodWorkOrder.update({
        where: { id: current.id },
        data: { status: ProdWoStatus.RELEASED, version: { increment: 1 } },
        include: {
          consumptions: true,
          outputs: true,
          scraps: true,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_wo',
        aggregateId: updated.id,
        eventType: PRODUCTION_EVENT_TYPES.WO_RELEASED,
        payloadJson: {
          workOrderId: updated.id,
          number: updated.number,
        },
      });

      return updated;
    });

    return this.toDto(companyId, row);
  }

  async declare(
    companyId: string,
    id: string,
    dto: DeclareWorkOrderDto,
  ): Promise<WorkOrderDto> {
    const current = await this.findActive(companyId, id);
    if (
      current.status !== ProdWoStatus.RELEASED &&
      current.status !== ProdWoStatus.IN_PROGRESS
    ) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Work order must be RELEASED or IN_PROGRESS to declare.',
        HttpStatus.CONFLICT,
      );
    }

    if (!dto.consumptions?.length) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.BOM_MISSING,
        'At least one consumption line is required.',
      );
    }

    const outputQty = toDecimal(dto.outputQty);
    if (outputQty.lte(0)) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_QTY,
        'outputQty must be positive.',
      );
    }

    const yieldRatio = outputQty.div(current.plannedQty);
    if (yieldRatio.lt(0.1) || yieldRatio.gt(2)) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.YIELD_OUT,
        'Yield outside allowed band (10%–200% of planned).',
        HttpStatus.CONFLICT,
        { yieldRatio: yieldRatio.toString() },
      );
    }

    for (const line of dto.consumptions) {
      await this.assertProduct(companyId, line.productId);
      if (toDecimal(line.qty).lte(0)) {
        throw new ProductionException(
          PRODUCTION_ERROR_CODES.INVALID_QTY,
          'Consumption qty must be positive.',
        );
      }
    }

    const scrapQty =
      dto.scrapQty != null ? toDecimal(dto.scrapQty) : new Prisma.Decimal(0);
    if (scrapQty.gt(0)) {
      const scrapProductId = dto.scrapProductId ?? current.productId;
      await this.assertProduct(companyId, scrapProductId);
    }

    // Mark in progress then post stock via inventory public API.
    await this.prisma.prodWorkOrder.update({
      where: { id: current.id },
      data: { status: ProdWoStatus.IN_PROGRESS },
    });

    try {
      for (const line of dto.consumptions) {
        try {
          await this.inventory.adjust(companyId, {
            productId: line.productId,
            warehouseId: current.warehouseId,
            qtyDelta: -Number(line.qty),
            reason: `WO ${current.number} consumption`,
          });
        } catch (err) {
          if (err instanceof InventoryException) {
            throw new ProductionException(
              PRODUCTION_ERROR_CODES.INSUFFICIENT_MP,
              err.message,
              HttpStatus.CONFLICT,
            );
          }
          throw err;
        }
      }

      await this.inventory.adjust(companyId, {
        productId: current.productId,
        warehouseId: current.warehouseId,
        qtyDelta: Number(dto.outputQty),
        reason: `WO ${current.number} output`,
      });
    } catch (err) {
      // Best-effort: leave IN_PROGRESS so operator can retry / investigate.
      throw err;
    }

    const lotOut = dto.lotOut?.trim() || current.lotOut;

    const row = await this.prisma.$transaction(async (tx) => {
      for (const line of dto.consumptions) {
        const cons = await tx.prodWoConsumption.create({
          data: {
            companyId,
            workOrderId: current.id,
            productId: line.productId,
            qty: toDecimal(line.qty),
            lotIn: line.lotIn?.trim() || null,
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'prd_wo',
          aggregateId: current.id,
          eventType: PRODUCTION_EVENT_TYPES.CONSUMPTION_POSTED,
          payloadJson: {
            workOrderId: current.id,
            consumptionId: cons.id,
            productId: line.productId,
            qty: toDecimal(line.qty).toString(),
          },
        });
      }

      const out = await tx.prodWoOutput.create({
        data: {
          companyId,
          workOrderId: current.id,
          productId: current.productId,
          qty: outputQty,
          lotOut,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_wo',
        aggregateId: current.id,
        eventType: PRODUCTION_EVENT_TYPES.OUTPUT_POSTED,
        payloadJson: {
          workOrderId: current.id,
          outputId: out.id,
          productId: current.productId,
          qty: outputQty.toString(),
          lotOut,
        },
      });

      if (scrapQty.gt(0)) {
        const scrapProductId = dto.scrapProductId ?? current.productId;
        const scrap = await tx.prodScrap.create({
          data: {
            companyId,
            workOrderId: current.id,
            productId: scrapProductId,
            qty: scrapQty,
            reason: dto.scrapReason?.trim() || null,
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'prd_wo',
          aggregateId: current.id,
          eventType: PRODUCTION_EVENT_TYPES.SCRAP_POSTED,
          payloadJson: {
            workOrderId: current.id,
            scrapId: scrap.id,
            productId: scrapProductId,
            qty: scrapQty.toString(),
          },
        });
      }

      const deviation =
        yieldRatio.lt(0.85) || yieldRatio.gt(1.15);
      if (deviation) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'prd_wo',
          aggregateId: current.id,
          eventType: PRODUCTION_EVENT_TYPES.YIELD_DEVIATION,
          payloadJson: {
            workOrderId: current.id,
            plannedQty: current.plannedQty.toString(),
            actualQty: outputQty.toString(),
            yieldRatio: yieldRatio.toString(),
          },
        });
      }

      return tx.prodWorkOrder.update({
        where: { id: current.id },
        data: {
          status: ProdWoStatus.DONE,
          actualQty: outputQty,
          lotOut,
          version: { increment: 1 },
        },
        include: {
          consumptions: true,
          outputs: true,
          scraps: true,
        },
      });
    });

    return this.toDto(companyId, row);
  }

  private async findActive(companyId: string, id: string) {
    const row = await this.prisma.prodWorkOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        consumptions: true,
        outputs: true,
        scraps: true,
      },
    });
    if (!row) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.NOT_FOUND,
        'Work order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
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
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async assertWarehouse(companyId: string, warehouseId: string) {
    const wh = await this.prisma.invWarehouse.findFirst({
      where: { id: warehouseId, companyId, deletedAt: null, active: true },
    });
    if (!wh) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.WAREHOUSE_NOT_FOUND,
        'Warehouse not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `OF-${year}-`;
    const count = await this.prisma.prodWorkOrder.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async toDto(
    companyId: string,
    row: ProdWorkOrder & {
      consumptions: Array<{
        id: string;
        productId: string;
        qty: Prisma.Decimal;
        lotIn: string | null;
        postedAt: Date;
      }>;
      outputs: Array<{
        id: string;
        productId: string;
        qty: Prisma.Decimal;
        lotOut: string | null;
        postedAt: Date;
      }>;
      scraps: Array<{
        id: string;
        productId: string;
        qty: Prisma.Decimal;
        reason: string | null;
        postedAt: Date;
      }>;
    },
  ): Promise<WorkOrderDto> {
    const [product, warehouse] = await Promise.all([
      this.prisma.prdProduct.findFirst({
        where: { id: row.productId, companyId },
        select: { sku: true, name: true },
      }),
      this.prisma.invWarehouse.findFirst({
        where: { id: row.warehouseId, companyId },
        select: { code: true },
      }),
    ]);

    const yieldRatio =
      row.actualQty && row.plannedQty.gt(0)
        ? row.actualQty.div(row.plannedQty).toString()
        : null;

    return {
      id: row.id,
      companyId: row.companyId,
      number: row.number,
      productId: row.productId,
      productSku: product?.sku ?? null,
      productName: product?.name ?? null,
      warehouseId: row.warehouseId,
      warehouseCode: warehouse?.code ?? null,
      plannedQty: row.plannedQty.toString(),
      actualQty: row.actualQty?.toString() ?? null,
      lotOut: row.lotOut,
      status: row.status,
      notes: row.notes,
      version: row.version,
      yieldRatio,
      consumptions: row.consumptions.map((c) => ({
        id: c.id,
        productId: c.productId,
        qty: c.qty.toString(),
        lotIn: c.lotIn,
        postedAt: c.postedAt.toISOString(),
      })),
      outputs: row.outputs.map((o) => ({
        id: o.id,
        productId: o.productId,
        qty: o.qty.toString(),
        lotOut: o.lotOut,
        postedAt: o.postedAt.toISOString(),
      })),
      scraps: row.scraps.map((s) => ({
        id: s.id,
        productId: s.productId,
        qty: s.qty.toString(),
        reason: s.reason,
        postedAt: s.postedAt.toISOString(),
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function toDecimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

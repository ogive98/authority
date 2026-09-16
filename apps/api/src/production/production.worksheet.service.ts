import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProdWorksheetControlResult,
  ProdWorksheetStatus,
  PrdProductStatus,
  type ProdWorksheet,
  type ProdWorksheetLine,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRODUCTION_ERROR_CODES,
  PRODUCTION_EVENT_TYPES,
} from './production.constants';
import type {
  ControlWorksheetDto,
  CreateWorksheetDto,
  PrepareWorksheetDto,
  WeighWorksheetDto,
} from './production.dto';
import { ProductionException } from './production.exception';

type WorksheetRow = ProdWorksheet & { lines: ProdWorksheetLine[] };

export type WorksheetLineDto = {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  requestedQty: string;
  preparedQty: string | null;
  weighedQty: string | null;
  unit: string;
  lot: string | null;
  notes: string | null;
};

export type WorksheetDto = {
  id: string;
  number: string;
  status: ProdWorksheetStatus;
  orderId: string | null;
  workOrderId: string | null;
  siteId: string | null;
  notes: string | null;
  controlResult: ProdWorksheetControlResult | null;
  controlNote: string | null;
  preparedAt: string | null;
  weighedAt: string | null;
  controlledAt: string | null;
  version: number;
  lines: WorksheetLineDto[];
  createdAt: string;
  updatedAt: string;
};

/**
 * D292 — Digital Worksheet Prep→Weigh→Control (Production).
 * Manual weigh · Soft Glass human gates · outbox events · no stock/invoice mutation.
 */
@Injectable()
export class ProductionWorksheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts: { q?: string; status?: string; limit?: number } = {},
  ): Promise<{ items: WorksheetDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const status = opts.status?.trim().toUpperCase();
    const rows = await this.prisma.prodWorksheet.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status &&
        Object.values(ProdWorksheetStatus).includes(
          status as ProdWorksheetStatus,
        )
          ? { status: status as ProdWorksheetStatus }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { notes: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });
    return {
      items: await Promise.all(rows.map((r) => this.toDto(companyId, r))),
    };
  }

  async get(companyId: string, id: string): Promise<WorksheetDto> {
    return this.toDto(companyId, await this.findActive(companyId, id));
  }

  async create(
    companyId: string,
    dto: CreateWorksheetDto,
  ): Promise<WorksheetDto> {
    if (dto.workOrderId) {
      const wo = await this.prisma.prodWorkOrder.findFirst({
        where: { id: dto.workOrderId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!wo) {
        throw new ProductionException(
          PRODUCTION_ERROR_CODES.NOT_FOUND,
          'Work order not found for worksheet link.',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    for (const line of dto.lines) {
      await this.assertProduct(companyId, line.productId);
    }

    const number = await this.nextNumber(companyId);
    const row = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.prodWorksheet.create({
        data: {
          companyId,
          number,
          status: ProdWorksheetStatus.DRAFT,
          orderId: dto.orderId ?? null,
          workOrderId: dto.workOrderId ?? null,
          siteId: dto.siteId ?? null,
          notes: dto.notes?.trim() || null,
          lines: {
            create: dto.lines.map((line, idx) => ({
              companyId,
              lineNo: idx + 1,
              productId: line.productId,
              requestedQty: toDecimal(line.requestedQty),
              unit: (line.unit?.trim() || 'KG').toUpperCase().slice(0, 16),
              lot: line.lot?.trim() || null,
              notes: line.notes?.trim() || null,
            })),
          },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_worksheet',
        aggregateId: ws.id,
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_CREATED,
        payloadJson: {
          worksheetId: ws.id,
          number: ws.number,
          lineCount: ws.lines.length,
          orderId: ws.orderId,
          workOrderId: ws.workOrderId,
        },
      });
      return ws;
    });
    return this.toDto(companyId, row);
  }

  async prepare(
    companyId: string,
    id: string,
    dto: PrepareWorksheetDto,
  ): Promise<WorksheetDto> {
    const row = await this.findActive(companyId, id);
    if (row.status !== ProdWorksheetStatus.DRAFT) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Only DRAFT worksheets can be prepared.',
        HttpStatus.CONFLICT,
      );
    }
    this.applyLineQtys(row, dto.lines, 'prepared');

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        await tx.prodWorksheetLine.update({
          where: { id: line.id },
          data: {
            preparedQty: toDecimal(line.qty),
            ...(line.lot !== undefined
              ? { lot: line.lot.trim() || null }
              : {}),
          },
        });
      }
      const ws = await tx.prodWorksheet.update({
        where: { id },
        data: {
          status: ProdWorksheetStatus.PREPARED,
          preparedAt: new Date(),
          version: { increment: 1 },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_worksheet',
        aggregateId: ws.id,
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_PREPARED,
        payloadJson: {
          worksheetId: ws.id,
          number: ws.number,
          lineCount: ws.lines.length,
        },
      });
      return ws;
    });
    return this.toDto(companyId, updated);
  }

  async weigh(
    companyId: string,
    id: string,
    dto: WeighWorksheetDto,
  ): Promise<WorksheetDto> {
    const row = await this.findActive(companyId, id);
    if (row.status !== ProdWorksheetStatus.PREPARED) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Only PREPARED worksheets can be weighed.',
        HttpStatus.CONFLICT,
      );
    }
    this.applyLineQtys(row, dto.lines, 'weighed');

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of dto.lines) {
        await tx.prodWorksheetLine.update({
          where: { id: line.id },
          data: {
            weighedQty: toDecimal(line.qty),
            ...(line.lot !== undefined
              ? { lot: line.lot.trim() || null }
              : {}),
          },
        });
      }
      const ws = await tx.prodWorksheet.update({
        where: { id },
        data: {
          status: ProdWorksheetStatus.WEIGHED,
          weighedAt: new Date(),
          version: { increment: 1 },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_worksheet',
        aggregateId: ws.id,
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_WEIGHED,
        payloadJson: {
          worksheetId: ws.id,
          number: ws.number,
          lineCount: ws.lines.length,
          note: 'Manual weigh only — no scale device (D292)',
        },
      });
      return ws;
    });
    return this.toDto(companyId, updated);
  }

  async control(
    companyId: string,
    id: string,
    dto: ControlWorksheetDto,
  ): Promise<WorksheetDto> {
    const row = await this.findActive(companyId, id);
    if (row.status !== ProdWorksheetStatus.WEIGHED) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Only WEIGHED worksheets can be controlled.',
        HttpStatus.CONFLICT,
      );
    }
    if (dto.result === 'FAIL' && !dto.note?.trim()) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Control FAIL requires a note.',
      );
    }

    const nextStatus =
      dto.result === 'PASS'
        ? ProdWorksheetStatus.CONTROLLED
        : ProdWorksheetStatus.REJECTED;
    const eventType =
      dto.result === 'PASS'
        ? PRODUCTION_EVENT_TYPES.WORKSHEET_CONTROLLED
        : PRODUCTION_EVENT_TYPES.WORKSHEET_REJECTED;

    const updated = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.prodWorksheet.update({
        where: { id },
        data: {
          status: nextStatus,
          controlResult:
            dto.result === 'PASS'
              ? ProdWorksheetControlResult.PASS
              : ProdWorksheetControlResult.FAIL,
          controlNote: dto.note?.trim() || null,
          controlledAt: new Date(),
          version: { increment: 1 },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_worksheet',
        aggregateId: ws.id,
        eventType,
        payloadJson: {
          worksheetId: ws.id,
          number: ws.number,
          result: dto.result,
          controlNote: ws.controlNote,
        },
      });
      return ws;
    });
    return this.toDto(companyId, updated);
  }

  async cancel(companyId: string, id: string): Promise<WorksheetDto> {
    const row = await this.findActive(companyId, id);
    if (
      row.status === ProdWorksheetStatus.CONTROLLED ||
      row.status === ProdWorksheetStatus.CANCELLED
    ) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_STATUS,
        'Cannot cancel a CONTROLLED or already CANCELLED worksheet.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const ws = await tx.prodWorksheet.update({
        where: { id },
        data: {
          status: ProdWorksheetStatus.CANCELLED,
          version: { increment: 1 },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'prd_worksheet',
        aggregateId: ws.id,
        eventType: PRODUCTION_EVENT_TYPES.WORKSHEET_CANCELLED,
        payloadJson: { worksheetId: ws.id, number: ws.number },
      });
      return ws;
    });
    return this.toDto(companyId, updated);
  }

  private applyLineQtys(
    row: WorksheetRow,
    lines: Array<{ id: string; qty: number }>,
    phase: 'prepared' | 'weighed',
  ): void {
    const byId = new Map(row.lines.map((l) => [l.id, l]));
    if (lines.length !== row.lines.length) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.INVALID_QTY,
        `All worksheet lines must include a ${phase} qty.`,
      );
    }
    for (const line of lines) {
      if (!byId.has(line.id)) {
        throw new ProductionException(
          PRODUCTION_ERROR_CODES.NOT_FOUND,
          `Worksheet line ${line.id} not found.`,
          HttpStatus.NOT_FOUND,
        );
      }
      if (!(line.qty > 0)) {
        throw new ProductionException(
          PRODUCTION_ERROR_CODES.INVALID_QTY,
          `${phase} qty must be positive.`,
        );
      }
    }
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<WorksheetRow> {
    const row = await this.prisma.prodWorksheet.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.NOT_FOUND,
        'Worksheet not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async assertProduct(
    companyId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.prisma.prdProduct.findFirst({
      where: {
        id: productId,
        companyId,
        deletedAt: null,
        status: PrdProductStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!product) {
      throw new ProductionException(
        PRODUCTION_ERROR_CODES.PRODUCT_NOT_FOUND,
        'Product not found or inactive.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `WS-${year}-`;
    const last = await this.prisma.prodWorksheet.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last
      ? Number(last.number.slice(prefix.length)) + 1 || 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async toDto(
    companyId: string,
    row: WorksheetRow,
  ): Promise<WorksheetDto> {
    const productIds = [...new Set(row.lines.map((l) => l.productId))];
    const products = productIds.length
      ? await this.prisma.prdProduct.findMany({
          where: { companyId, id: { in: productIds } },
          select: { id: true, sku: true, name: true },
        })
      : [];
    const byProduct = new Map(products.map((p) => [p.id, p]));
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      orderId: row.orderId,
      workOrderId: row.workOrderId,
      siteId: row.siteId,
      notes: row.notes,
      controlResult: row.controlResult,
      controlNote: row.controlNote,
      preparedAt: row.preparedAt?.toISOString() ?? null,
      weighedAt: row.weighedAt?.toISOString() ?? null,
      controlledAt: row.controlledAt?.toISOString() ?? null,
      version: row.version,
      lines: row.lines.map((l) => {
        const p = byProduct.get(l.productId);
        return {
          id: l.id,
          lineNo: l.lineNo,
          productId: l.productId,
          productSku: p?.sku ?? null,
          productName: p?.name ?? null,
          requestedQty: l.requestedQty.toString(),
          preparedQty: l.preparedQty?.toString() ?? null,
          weighedQty: l.weighedQty?.toString() ?? null,
          unit: l.unit,
          lot: l.lot,
          notes: l.notes,
        };
      }),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

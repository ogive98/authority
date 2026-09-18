import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  DlvShipmentStatus,
  FinInvoiceStatus,
  Prisma,
  RetDisposition,
  RetRma,
  RetRmaLine,
  RetRmaStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { CreditNoteService } from '../finance/credit-note.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  RETURNS_ERROR_CODES,
  RETURNS_EVENT_TYPES,
} from './returns.constants';
import type {
  CreateReturnsRmaDto,
  ReturnsRmaLineInputDto,
  UpdateReturnsRmaDto,
} from './returns.dto';
import { ReturnsException } from './returns.exception';

export type ReturnsRmaLineDto = {
  id: string;
  lineNo: number;
  orderLineId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  qty: string;
  disposition: RetDisposition;
  unitPrice: string;
};

export type ReturnsRmaDto = {
  id: string;
  companyId: string;
  number: string;
  shipmentId: string;
  shipmentNumber: string | null;
  orderId: string;
  orderNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  creditNoteId: string | null;
  creditNoteNumber: string | null;
  status: RetRmaStatus;
  notes: string | null;
  version: number;
  postedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ReturnsRmaLineDto[];
};

type RmaWithLines = RetRma & { lines: RetRmaLine[] };

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
    private readonly creditNotes: CreditNoteService,
  ) {}

  async list(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      shipmentId?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: ReturnsRmaDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.RetRmaWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.shipmentId) where.shipmentId = opts.shipmentId;
    if (opts.customerId) where.customerId = opts.customerId;
    const status = opts.status?.trim().toUpperCase();
    if (
      status &&
      Object.values(RetRmaStatus).includes(status as RetRmaStatus)
    ) {
      where.status = status as RetRmaStatus;
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.retRma.findMany({
      where,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return {
      items: await this.enrichMany(companyId, page),
      nextCursor,
    };
  }

  async get(companyId: string, id: string): Promise<ReturnsRmaDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateReturnsRmaDto,
  ): Promise<ReturnsRmaDto> {
    const ctx = await this.loadShipmentContext(companyId, dto.shipmentId);
    const lineInputs = await this.normalizeLines(companyId, ctx, dto.lines);
    const invoice = await this.findShipmentInvoice(companyId, ctx.shipment.id);
    const number = await this.nextNumber(companyId);

    const row = await this.prisma.$transaction(async (tx) => {
      const rma = await tx.retRma.create({
        data: {
          companyId,
          number,
          shipmentId: ctx.shipment.id,
          orderId: ctx.order.id,
          customerId: ctx.shipment.customerId,
          warehouseId: ctx.shipment.warehouseId,
          invoiceId: invoice?.id ?? null,
          notes: dto.notes?.trim() || null,
          status: RetRmaStatus.DRAFT,
          lines: {
            create: lineInputs.map((l, idx) => ({
              companyId,
              lineNo: idx + 1,
              orderLineId: l.orderLineId,
              productId: l.productId,
              qty: l.qty,
              disposition: l.disposition,
              unitPrice: l.unitPrice,
            })),
          },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ret_rma',
        aggregateId: rma.id,
        eventType: RETURNS_EVENT_TYPES.CREATED,
        payloadJson: {
          rmaId: rma.id,
          number: rma.number,
          shipmentId: rma.shipmentId,
          status: rma.status,
        },
      });

      return rma;
    });

    return this.enrichOne(companyId, row);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateReturnsRmaDto,
  ): Promise<ReturnsRmaDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== RetRmaStatus.DRAFT) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.INVALID_STATUS,
        'Only draft RMAs can be updated.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.version !== dto.version) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.VERSION_CONFLICT,
        'RMA changed concurrently — reload.',
        HttpStatus.CONFLICT,
      );
    }

    const ctx = await this.loadShipmentContext(companyId, existing.shipmentId);
    const lineInputs = dto.lines
      ? await this.normalizeLines(companyId, ctx, dto.lines, id)
      : null;

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.retRma.updateMany({
        where: { id, companyId, version: dto.version, deletedAt: null },
        data: {
          notes:
            dto.notes === undefined ? undefined : dto.notes?.trim() || null,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.VERSION_CONFLICT,
          'RMA changed concurrently — reload.',
          HttpStatus.CONFLICT,
        );
      }

      if (lineInputs) {
        await tx.retRmaLine.deleteMany({ where: { rmaId: id } });
        await tx.retRmaLine.createMany({
          data: lineInputs.map((l, idx) => ({
            companyId,
            rmaId: id,
            lineNo: idx + 1,
            orderLineId: l.orderLineId,
            productId: l.productId,
            qty: l.qty,
            disposition: l.disposition,
            unitPrice: l.unitPrice,
          })),
        });
      }

      return tx.retRma.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async post(companyId: string, id: string): Promise<ReturnsRmaDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== RetRmaStatus.DRAFT) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.INVALID_STATUS,
        'Only draft RMAs can be posted.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.lines.length === 0) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.EMPTY_LINES,
        'RMA has no lines.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Re-validate qty caps at post time.
    const ctx = await this.loadShipmentContext(companyId, existing.shipmentId);
    await this.normalizeLines(
      companyId,
      ctx,
      existing.lines.map((l) => ({
        orderLineId: l.orderLineId,
        qty: Number(l.qty.toString()),
        disposition: l.disposition,
      })),
      id,
    );

    for (const line of existing.lines) {
      if (line.disposition !== RetDisposition.RESTOCK) continue;
      await this.inventory.adjust(companyId, {
        warehouseId: existing.warehouseId,
        productId: line.productId,
        qtyDelta: Number(line.qty.toString()),
        reason: `RMA ${existing.number} restock`,
      });
    }

    let creditNoteId = existing.creditNoteId;
    const invoice =
      (existing.invoiceId
        ? await this.prisma.finInvoice.findFirst({
            where: {
              id: existing.invoiceId,
              companyId,
              deletedAt: null,
              status: FinInvoiceStatus.ISSUED,
            },
            include: { lines: { orderBy: { lineNo: 'asc' } } },
          })
        : null) ??
      (await this.findShipmentInvoice(companyId, existing.shipmentId));

    if (!creditNoteId && invoice) {
      try {
        const cn = await this.createCreditNoteForRma(
          companyId,
          existing,
          invoice,
        );
        creditNoteId = cn.id;
      } catch (err) {
        this.logger.warn(
          `Auto credit-note skipped for RMA ${existing.number}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.retRma.updateMany({
        where: {
          id,
          companyId,
          status: RetRmaStatus.DRAFT,
          deletedAt: null,
        },
        data: {
          status: RetRmaStatus.POSTED,
          postedAt: new Date(),
          invoiceId: invoice?.id ?? existing.invoiceId,
          creditNoteId,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_STATUS,
          'Only draft RMAs can be posted.',
          HttpStatus.CONFLICT,
        );
      }

      const rma = await tx.retRma.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ret_rma',
        aggregateId: rma.id,
        eventType: RETURNS_EVENT_TYPES.POSTED,
        payloadJson: {
          rmaId: rma.id,
          number: rma.number,
          shipmentId: rma.shipmentId,
          creditNoteId: rma.creditNoteId,
          status: rma.status,
        },
      });

      return rma;
    });

    return this.enrichOne(companyId, row);
  }

  async cancel(companyId: string, id: string): Promise<ReturnsRmaDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== RetRmaStatus.DRAFT) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.INVALID_STATUS,
        'Only draft RMAs can be cancelled.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.retRma.updateMany({
        where: {
          id,
          companyId,
          status: RetRmaStatus.DRAFT,
          deletedAt: null,
        },
        data: {
          status: RetRmaStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_STATUS,
          'Only draft RMAs can be cancelled.',
          HttpStatus.CONFLICT,
        );
      }

      const rma = await tx.retRma.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ret_rma',
        aggregateId: rma.id,
        eventType: RETURNS_EVENT_TYPES.CANCELLED,
        payloadJson: {
          rmaId: rma.id,
          number: rma.number,
          status: rma.status,
        },
      });

      return rma;
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Manual CTA (1A) — create CN DRAFT if missing; idempotent when already linked.
   */
  async createCreditNote(
    companyId: string,
    id: string,
  ): Promise<ReturnsRmaDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== RetRmaStatus.POSTED) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.INVALID_STATUS,
        'Credit note can only be created for posted RMAs.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.creditNoteId) {
      return this.enrichOne(companyId, existing);
    }

    const invoice =
      (existing.invoiceId
        ? await this.prisma.finInvoice.findFirst({
            where: {
              id: existing.invoiceId,
              companyId,
              deletedAt: null,
              status: FinInvoiceStatus.ISSUED,
            },
            include: { lines: { orderBy: { lineNo: 'asc' } } },
          })
        : null) ??
      (await this.findShipmentInvoice(companyId, existing.shipmentId));

    if (!invoice) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.INVOICE_NOT_FOUND,
        'No ISSUED invoice linked to this shipment.',
        HttpStatus.NOT_FOUND,
      );
    }

    const cn = await this.createCreditNoteForRma(companyId, existing, invoice);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.retRma.updateMany({
        where: { id, companyId, deletedAt: null, creditNoteId: null },
        data: {
          creditNoteId: cn.id,
          invoiceId: invoice.id,
          version: { increment: 1 },
        },
      });
      const rma = await tx.retRma.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'ret_rma',
        aggregateId: rma.id,
        eventType: RETURNS_EVENT_TYPES.CREDIT_NOTE_LINKED,
        payloadJson: {
          rmaId: rma.id,
          creditNoteId: cn.id,
          invoiceId: invoice.id,
        },
      });
      return rma;
    });

    return this.enrichOne(companyId, row);
  }

  private async createCreditNoteForRma(
    companyId: string,
    rma: RmaWithLines,
    invoice: {
      id: string;
      lines: Array<{
        description: string;
        qty: Prisma.Decimal;
        unitPriceHt: Prisma.Decimal;
        taxCodeId: string;
        productId: string | null;
      }>;
    },
  ) {
    const invByProduct = new Map(
      invoice.lines
        .filter((l) => l.productId)
        .map((l) => [l.productId!, l] as const),
    );
    const cnLines = [];
    for (const line of rma.lines) {
      const inv = invByProduct.get(line.productId);
      if (!inv) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_LINE,
          `No invoice line for product ${line.productId}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      cnLines.push({
        description: inv.description,
        qty: Number(line.qty.toString()),
        unitPriceHt: Number(inv.unitPriceHt.toString()),
        taxCodeId: inv.taxCodeId,
        productId: line.productId,
      });
    }

    return this.creditNotes.create(companyId, {
      sourceInvoiceId: invoice.id,
      lines: cnLines,
      reason: `Retour ${rma.number}`,
      notes: rma.notes ?? undefined,
      issue: false,
    });
  }

  private async findShipmentInvoice(companyId: string, shipmentId: string) {
    return this.prisma.finInvoice.findFirst({
      where: {
        companyId,
        shipmentId,
        deletedAt: null,
        status: FinInvoiceStatus.ISSUED,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadShipmentContext(companyId: string, shipmentId: string) {
    const shipment = await this.prisma.dlvShipment.findFirst({
      where: { id: shipmentId, companyId, deletedAt: null },
    });
    if (!shipment) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.SHIPMENT_NOT_FOUND,
        'Shipment not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (shipment.status !== DlvShipmentStatus.DELIVERED) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.SHIPMENT_NOT_DELIVERED,
        'Only DELIVERED shipments can be returned.',
        HttpStatus.CONFLICT,
      );
    }

    const order = await this.prisma.salOrder.findFirst({
      where: { id: shipment.orderId, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!order) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.ORDER_NOT_FOUND,
        'Sales order for shipment not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    return { shipment, order };
  }

  private async normalizeLines(
    companyId: string,
    ctx: {
      shipment: { id: string; orderId: string };
      order: {
        id: string;
        lines: Array<{
          id: string;
          productId: string;
          qty: Prisma.Decimal;
          unitPrice: Prisma.Decimal;
          discountPct: Prisma.Decimal;
          deliveredQty: Prisma.Decimal | null;
        }>;
      };
    },
    lines: ReturnsRmaLineInputDto[],
    excludeRmaId?: string,
  ): Promise<
    Array<{
      orderLineId: string;
      productId: string;
      qty: Prisma.Decimal;
      disposition: RetDisposition;
      unitPrice: Prisma.Decimal;
    }>
  > {
    if (!lines.length) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.EMPTY_LINES,
        'At least one line is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const orderLineById = new Map(ctx.order.lines.map((l) => [l.id, l]));
    const alreadyReturned = await this.postedQtyByOrderLine(
      companyId,
      ctx.order.id,
      excludeRmaId,
    );

    const seen = new Set<string>();
    const result = [];
    for (const input of lines) {
      if (seen.has(input.orderLineId)) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_LINE,
          'Duplicate order line in RMA.',
          HttpStatus.BAD_REQUEST,
        );
      }
      seen.add(input.orderLineId);

      const ol = orderLineById.get(input.orderLineId);
      if (!ol) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_LINE,
          'Order line not on shipment order.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const qty = new Prisma.Decimal(input.qty);
      if (qty.lte(0)) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.INVALID_LINE,
          'Invalid return quantity.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const delivered = new Prisma.Decimal(ol.deliveredQty ?? 0);
      const returned = alreadyReturned.get(ol.id) ?? new Prisma.Decimal(0);
      const remaining = delivered.sub(returned);
      if (qty.gt(remaining)) {
        throw new ReturnsException(
          RETURNS_ERROR_CODES.QTY_EXCEEDED,
          `Return qty exceeds remaining delivered for line (max ${remaining.toString()}).`,
          HttpStatus.CONFLICT,
          {
            orderLineId: ol.id,
            delivered: delivered.toString(),
            alreadyReturned: returned.toString(),
            remaining: remaining.toString(),
          },
        );
      }

      const discountFactor = new Prisma.Decimal(1).sub(ol.discountPct.div(100));
      const unitPrice = ol.unitPrice.mul(discountFactor);

      result.push({
        orderLineId: ol.id,
        productId: ol.productId,
        qty,
        disposition: input.disposition,
        unitPrice,
      });
    }

    return result;
  }

  private async postedQtyByOrderLine(
    companyId: string,
    orderId: string,
    excludeRmaId?: string,
  ): Promise<Map<string, Prisma.Decimal>> {
    const rows = await this.prisma.retRmaLine.findMany({
      where: {
        companyId,
        rma: {
          companyId,
          orderId,
          status: RetRmaStatus.POSTED,
          deletedAt: null,
          ...(excludeRmaId ? { id: { not: excludeRmaId } } : {}),
        },
      },
      select: { orderLineId: true, qty: true },
    });
    const map = new Map<string, Prisma.Decimal>();
    for (const row of rows) {
      const prev = map.get(row.orderLineId) ?? new Prisma.Decimal(0);
      map.set(row.orderLineId, prev.add(row.qty));
    }
    return map;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RET-${year}-`;
    const count = await this.prisma.retRma.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<RmaWithLines> {
    const row = await this.prisma.retRma.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new ReturnsException(
        RETURNS_ERROR_CODES.NOT_FOUND,
        'RMA not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async enrichMany(
    companyId: string,
    rows: RmaWithLines[],
  ): Promise<ReturnsRmaDto[]> {
    if (rows.length === 0) return [];
    const shipmentIds = [...new Set(rows.map((r) => r.shipmentId))];
    const orderIds = [...new Set(rows.map((r) => r.orderId))];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];
    const invoiceIds = [
      ...new Set(rows.map((r) => r.invoiceId).filter((id): id is string => !!id)),
    ];
    const creditNoteIds = [
      ...new Set(
        rows.map((r) => r.creditNoteId).filter((id): id is string => !!id),
      ),
    ];
    const productIds = [
      ...new Set(rows.flatMap((r) => r.lines.map((l) => l.productId))),
    ];

    const [
      shipments,
      orders,
      customers,
      warehouses,
      invoices,
      creditNotes,
      products,
    ] = await Promise.all([
      this.prisma.dlvShipment.findMany({
        where: { companyId, id: { in: shipmentIds } },
        select: { id: true, number: true },
      }),
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
        select: { id: true, code: true },
      }),
      invoiceIds.length
        ? this.prisma.finInvoice.findMany({
            where: { companyId, id: { in: invoiceIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
      creditNoteIds.length
        ? this.prisma.finCreditNote.findMany({
            where: { companyId, id: { in: creditNoteIds } },
            select: { id: true, number: true },
          })
        : Promise.resolve([]),
      this.prisma.prdProduct.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      }),
    ]);

    const shipmentMap = new Map(shipments.map((s) => [s.id, s]));
    const orderMap = new Map(orders.map((o) => [o.id, o]));
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
    const cnMap = new Map(creditNotes.map((c) => [c.id, c]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    return rows.map((row) => {
      const customer = customerMap.get(row.customerId);
      return {
        id: row.id,
        companyId: row.companyId,
        number: row.number,
        shipmentId: row.shipmentId,
        shipmentNumber: shipmentMap.get(row.shipmentId)?.number ?? null,
        orderId: row.orderId,
        orderNumber: orderMap.get(row.orderId)?.number ?? null,
        customerId: row.customerId,
        customerCode: customer?.code ?? null,
        customerName: customer?.party.legalName ?? null,
        warehouseId: row.warehouseId,
        warehouseCode: warehouseMap.get(row.warehouseId)?.code ?? null,
        invoiceId: row.invoiceId,
        invoiceNumber: row.invoiceId
          ? invoiceMap.get(row.invoiceId)?.number ?? null
          : null,
        creditNoteId: row.creditNoteId,
        creditNoteNumber: row.creditNoteId
          ? cnMap.get(row.creditNoteId)?.number ?? null
          : null,
        status: row.status,
        notes: row.notes,
        version: row.version,
        postedAt: row.postedAt?.toISOString() ?? null,
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lines: row.lines.map((l) => {
          const p = productMap.get(l.productId);
          return {
            id: l.id,
            lineNo: l.lineNo,
            orderLineId: l.orderLineId,
            productId: l.productId,
            productSku: p?.sku ?? null,
            productName: p?.name ?? null,
            qty: l.qty.toString(),
            disposition: l.disposition,
            unitPrice: l.unitPrice.toString(),
          };
        }),
      };
    });
  }

  private async enrichOne(
    companyId: string,
    row: RmaWithLines,
  ): Promise<ReturnsRmaDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto;
  }
}

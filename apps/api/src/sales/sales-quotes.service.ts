import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CusCustomerStatus,
  MdPartyStatus,
  Prisma,
  PrdProductStatus,
  SalQuote,
  SalQuoteLine,
  SalQuoteStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { SALES_ERROR_CODES, SALES_EVENT_TYPES, SALES_SETTING_DEFAULTS, SALES_SETTING_KEYS } from './sales.constants';
import { SalesException } from './sales.exception';
import type { CreateSalesQuoteDto, UpdateSalesQuoteDto } from './sales-quotes.dto';
import {
  normalizeSalesLines,
  sumNormalizedLineTotals,
} from './sales-lines.util';
import { SalesService, type SalesOrderDto } from './sales.service';

export type SalesQuoteLineDto = {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  qty: string;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
};

export type SalesQuoteDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  status: SalQuoteStatus;
  validUntil: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  version: number;
  convertedOrderId: string | null;
  pdfDocumentId: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesQuoteLineDto[];
};

export type ConvertQuoteResult = {
  quote: SalesQuoteDto;
  order: SalesOrderDto;
};

type QuoteWithLines = SalQuote & { lines: SalQuoteLine[] };

@Injectable()
export class SalesQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly sales: SalesService,
  ) {}

  async list(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: SalesQuoteDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.SalQuoteWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.customerId) {
      where.customerId = opts.customerId;
    }
    const status = opts.status?.trim().toUpperCase();
    if (
      status &&
      Object.values(SalQuoteStatus).includes(status as SalQuoteStatus)
    ) {
      where.status = status as SalQuoteStatus;
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      const matchingCustomers = await this.prisma.cusCustomer.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { nickname: { contains: q, mode: 'insensitive' } },
            {
              party: { legalName: { contains: q, mode: 'insensitive' } },
            },
          ],
        },
        select: { id: true },
        take: 100,
      });
      const customerIds = matchingCustomers.map((c) => c.id);
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        ...(customerIds.length > 0
          ? [{ customerId: { in: customerIds } }]
          : []),
      ];
    }

    const rows = await this.prisma.salQuote.findMany({
      where,
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    const enriched = await this.enrichMany(companyId, page);
    return { items: enriched, nextCursor };
  }

  async get(companyId: string, id: string): Promise<SalesQuoteDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateSalesQuoteDto,
  ): Promise<SalesQuoteDto> {
    await this.assertCustomer(companyId, dto.customerId);
    if (dto.warehouseId) {
      await this.assertWarehouse(companyId, dto.warehouseId);
    }
    const lineInputs = normalizeSalesLines(dto.lines);
    await this.assertProducts(
      companyId,
      lineInputs.map((l) => l.productId),
    );

    const amountTotal = sumNormalizedLineTotals(lineInputs);
    const number = await this.nextQuoteNumber(companyId);
    const currency =
      (dto.currency ?? (await this.defaultCurrency(companyId))).trim() ||
      'TND';

    const row = await this.prisma.$transaction(async (tx) => {
      const quote = await tx.salQuote.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId ?? null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          currency,
          notes: dto.notes?.trim() || null,
          amountTotal,
          status: SalQuoteStatus.DRAFT,
          lines: {
            create: lineInputs.map((l, idx) => ({
              companyId,
              lineNo: idx + 1,
              productId: l.productId,
              qty: l.qty,
              unitPrice: l.unitPrice,
              discountPct: l.discountPct,
              lineTotal: l.lineTotal,
            })),
          },
        },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quote.id,
        eventType: SALES_EVENT_TYPES.QUOTE_CREATED,
        payloadJson: {
          quoteId: quote.id,
          number: quote.number,
          customerId: quote.customerId,
          status: quote.status,
          amountTotal: quote.amountTotal.toString(),
        },
      });

      return quote;
    });

    return this.enrichOne(companyId, row);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateSalesQuoteDto,
  ): Promise<SalesQuoteDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== SalQuoteStatus.DRAFT) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Only draft quotes can be updated.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.version !== dto.version) {
      throw new SalesException(
        SALES_ERROR_CODES.VERSION_CONFLICT,
        'Quote changed concurrently — reload.',
        HttpStatus.CONFLICT,
      );
    }

    const customerId = dto.customerId ?? existing.customerId;
    const warehouseId =
      dto.warehouseId === undefined ? existing.warehouseId : dto.warehouseId;
    await this.assertCustomer(companyId, customerId);
    if (warehouseId) {
      await this.assertWarehouse(companyId, warehouseId);
    }

    const lineInputs = dto.lines
      ? normalizeSalesLines(dto.lines)
      : existing.lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discountPct: l.discountPct,
          lineTotal: l.lineTotal,
        }));

    if (dto.lines) {
      await this.assertProducts(
        companyId,
        lineInputs.map((l) => l.productId),
      );
    }

    const amountTotal = sumNormalizedLineTotals(lineInputs);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salQuote.updateMany({
        where: { id, companyId, version: dto.version, deletedAt: null },
        data: {
          customerId,
          warehouseId,
          validUntil:
            dto.validUntil === undefined
              ? undefined
              : dto.validUntil
                ? new Date(dto.validUntil)
                : null,
          currency: dto.currency?.trim() || undefined,
          notes:
            dto.notes === undefined
              ? undefined
              : dto.notes?.trim() || null,
          amountTotal,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new SalesException(
          SALES_ERROR_CODES.VERSION_CONFLICT,
          'Quote changed concurrently — reload.',
          HttpStatus.CONFLICT,
        );
      }

      if (dto.lines) {
        await tx.salQuoteLine.deleteMany({ where: { quoteId: id } });
        await tx.salQuoteLine.createMany({
          data: lineInputs.map((l, idx) => ({
            companyId,
            quoteId: id,
            lineNo: idx + 1,
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            lineTotal: l.lineTotal,
          })),
        });
      }

      return tx.salQuote.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async send(companyId: string, id: string): Promise<SalesQuoteDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== SalQuoteStatus.DRAFT) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Only draft quotes can be sent.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.lines.length === 0) {
      throw new SalesException(
        SALES_ERROR_CODES.EMPTY_LINES,
        'Quote has no lines.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salQuote.updateMany({
        where: {
          id,
          companyId,
          status: SalQuoteStatus.DRAFT,
          deletedAt: null,
        },
        data: {
          status: SalQuoteStatus.SENT,
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new SalesException(
          SALES_ERROR_CODES.INVALID_STATUS,
          'Only draft quotes can be sent.',
          HttpStatus.CONFLICT,
        );
      }

      const quote = await tx.salQuote.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quote.id,
        eventType: SALES_EVENT_TYPES.QUOTE_SENT,
        payloadJson: {
          quoteId: quote.id,
          number: quote.number,
          status: quote.status,
        },
      });

      return quote;
    });

    return this.enrichOne(companyId, row);
  }

  async cancel(companyId: string, id: string): Promise<SalesQuoteDto> {
    const existing = await this.findActive(companyId, id);
    if (
      existing.status === SalQuoteStatus.CANCELLED ||
      existing.status === SalQuoteStatus.ACCEPTED
    ) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Quote cannot be cancelled in its current status.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salQuote.updateMany({
        where: {
          id,
          companyId,
          status: { in: [SalQuoteStatus.DRAFT, SalQuoteStatus.SENT] },
          deletedAt: null,
        },
        data: {
          status: SalQuoteStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        throw new SalesException(
          SALES_ERROR_CODES.INVALID_STATUS,
          'Quote cannot be cancelled in its current status.',
          HttpStatus.CONFLICT,
        );
      }

      const quote = await tx.salQuote.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quote.id,
        eventType: SALES_EVENT_TYPES.QUOTE_CANCELLED,
        payloadJson: {
          quoteId: quote.id,
          number: quote.number,
          status: quote.status,
        },
      });

      return quote;
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Convert SENT quote → SalOrder DRAFT (no auto-confirm).
   * Idempotent when already ACCEPTED with convertedOrderId.
   */
  async convert(companyId: string, id: string): Promise<ConvertQuoteResult> {
    const existing = await this.findActive(companyId, id);

    if (
      existing.status === SalQuoteStatus.ACCEPTED &&
      existing.convertedOrderId
    ) {
      const order = await this.sales.get(companyId, existing.convertedOrderId);
      const quote = await this.enrichOne(companyId, existing);
      return { quote, order };
    }

    if (existing.status !== SalQuoteStatus.SENT) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Only sent quotes can be converted (or already converted).',
        HttpStatus.CONFLICT,
      );
    }

    if (!existing.warehouseId) {
      throw new SalesException(
        SALES_ERROR_CODES.WAREHOUSE_NOT_FOUND,
        'Quote has no warehouse — set warehouse before convert.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (existing.lines.length === 0) {
      throw new SalesException(
        SALES_ERROR_CODES.EMPTY_LINES,
        'Quote has no lines.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const order = await this.sales.create(companyId, {
      customerId: existing.customerId,
      warehouseId: existing.warehouseId,
      currency: existing.currency,
      notes: existing.notes
        ? `Devis ${existing.number}: ${existing.notes}`
        : `Converti depuis devis ${existing.number}`,
      lines: existing.lines.map((l) => ({
        productId: l.productId,
        qty: Number(l.qty.toString()),
        unitPrice: Number(l.unitPrice.toString()),
        discountPct: Number(l.discountPct.toString()),
      })),
      confirmAfter: false,
    });

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salQuote.updateMany({
        where: {
          id,
          companyId,
          status: SalQuoteStatus.SENT,
          deletedAt: null,
        },
        data: {
          status: SalQuoteStatus.ACCEPTED,
          convertedOrderId: order.id,
          acceptedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) {
        // Race: another convert won — return whatever is stored.
        const current = await tx.salQuote.findFirstOrThrow({
          where: { id, companyId },
          include: { lines: { orderBy: { lineNo: 'asc' } } },
        });
        return current;
      }

      const quote = await tx.salQuote.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_quote',
        aggregateId: quote.id,
        eventType: SALES_EVENT_TYPES.QUOTE_CONVERTED,
        payloadJson: {
          quoteId: quote.id,
          number: quote.number,
          orderId: order.id,
          orderNumber: order.number,
          status: quote.status,
        },
      });

      return quote;
    });

    // If race left a different convertedOrderId, load that order.
    if (row.convertedOrderId && row.convertedOrderId !== order.id) {
      const winningOrder = await this.sales.get(
        companyId,
        row.convertedOrderId,
      );
      return {
        quote: await this.enrichOne(companyId, row),
        order: winningOrder,
      };
    }

    return {
      quote: await this.enrichOne(companyId, row),
      order,
    };
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<QuoteWithLines> {
    const row = await this.prisma.salQuote.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new SalesException(
        SALES_ERROR_CODES.NOT_FOUND,
        'Quote not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextQuoteNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `DEV-${year}-`;
    const count = await this.prisma.salQuote.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async defaultCurrency(companyId: string): Promise<string> {
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: SALES_SETTING_KEYS.DEFAULT_CURRENCY,
        scopeKey: `company:${companyId}`,
        deletedAt: null,
      },
    });
    if (!row?.valueJson) {
      return SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.DEFAULT_CURRENCY];
    }
    return (
      String(row.valueJson).replace(/^"|"$/g, '') ||
      SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.DEFAULT_CURRENCY]
    );
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      include: { party: true },
    });
    if (!customer) {
      throw new SalesException(
        SALES_ERROR_CODES.CUSTOMER_NOT_FOUND,
        'Customer not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (customer.blocked === true) {
      throw new SalesException(
        SALES_ERROR_CODES.CUSTOMER_BLOCKED,
        'Customer is blocked.',
        HttpStatus.CONFLICT,
      );
    }
    if (customer.status !== CusCustomerStatus.ACTIVE) {
      throw new SalesException(
        SALES_ERROR_CODES.CUSTOMER_BLOCKED,
        'Customer is inactive.',
        HttpStatus.CONFLICT,
      );
    }
    if (customer.party.status === MdPartyStatus.BLOCKED) {
      throw new SalesException(
        SALES_ERROR_CODES.CUSTOMER_BLOCKED,
        'Customer party is blocked.',
        HttpStatus.CONFLICT,
      );
    }
    return customer;
  }

  private async assertWarehouse(companyId: string, warehouseId: string) {
    const wh = await this.prisma.invWarehouse.findFirst({
      where: { id: warehouseId, companyId, deletedAt: null, active: true },
    });
    if (!wh) {
      throw new SalesException(
        SALES_ERROR_CODES.WAREHOUSE_NOT_FOUND,
        'Warehouse not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async assertProducts(companyId: string, productIds: string[]) {
    const unique = [...new Set(productIds)];
    const products = await this.prisma.prdProduct.findMany({
      where: {
        companyId,
        id: { in: unique },
        deletedAt: null,
        status: { in: [PrdProductStatus.ACTIVE, PrdProductStatus.DRAFT] },
      },
      select: { id: true },
    });
    if (products.length !== unique.length) {
      throw new SalesException(
        SALES_ERROR_CODES.PRODUCT_NOT_FOUND,
        'One or more products not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async enrichMany(
    companyId: string,
    rows: QuoteWithLines[],
  ): Promise<SalesQuoteDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const warehouseIds = [
      ...new Set(
        rows.map((r) => r.warehouseId).filter((id): id is string => !!id),
      ),
    ];
    const productIds = [
      ...new Set(rows.flatMap((r) => r.lines.map((l) => l.productId))),
    ];

    const [customers, warehouses, products] = await Promise.all([
      this.prisma.cusCustomer.findMany({
        where: { companyId, id: { in: customerIds } },
        include: { party: true },
      }),
      warehouseIds.length
        ? this.prisma.invWarehouse.findMany({
            where: { companyId, id: { in: warehouseIds } },
          })
        : Promise.resolve([]),
      this.prisma.prdProduct.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      }),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    return rows.map((row) =>
      serializeQuote(
        row,
        customerMap.get(row.customerId) ?? null,
        row.warehouseId ? warehouseMap.get(row.warehouseId) ?? null : null,
        productMap,
      ),
    );
  }

  private async enrichOne(
    companyId: string,
    row: QuoteWithLines,
  ): Promise<SalesQuoteDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto;
  }
}

function serializeQuote(
  row: QuoteWithLines,
  customer?: {
    code: string;
    party: { legalName: string };
  } | null,
  warehouse?: { code: string } | null,
  products?: Map<string, { sku: string; name: string }>,
): SalesQuoteDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    customerId: row.customerId,
    customerCode: customer?.code ?? null,
    customerName: customer?.party.legalName ?? null,
    warehouseId: row.warehouseId,
    warehouseCode: warehouse?.code ?? null,
    status: row.status,
    validUntil: row.validUntil
      ? row.validUntil.toISOString().slice(0, 10)
      : null,
    currency: row.currency,
    notes: row.notes,
    amountTotal: row.amountTotal.toString(),
    version: row.version,
    convertedOrderId: row.convertedOrderId,
    pdfDocumentId: row.pdfDocumentId ?? null,
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map((l) => {
      const p = products?.get(l.productId);
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
      };
    }),
  };
}

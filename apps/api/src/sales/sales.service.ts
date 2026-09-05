import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CusCustomerStatus,
  MdPartyStatus,
  Prisma,
  PrdProductStatus,
  SalOrder,
  SalOrderLine,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SALES_ERROR_CODES,
  SALES_EVENT_TYPES,
  SALES_RESERVE_REF_TYPE,
  SALES_SETTING_DEFAULTS,
  SALES_SETTING_KEYS,
} from './sales.constants';
import { SalesException } from './sales.exception';
import type {
  CreateSalesOrderDto,
  SalesOrderLineInputDto,
  UpdateSalesOrderDto,
} from './sales.dto';

export type SalesOrderLineDto = {
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

export type SalesOrderDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  status: SalOrderStatus;
  requestedDate: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  version: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLineDto[];
};

type OrderWithLines = SalOrder & { lines: SalOrderLine[] };

export type SalesIntakeSettings = {
  reserveOnConfirm: boolean;
  autoConfirmOnCreate: boolean;
  requireRequestedDate: boolean;
  allowManualPrice: boolean;
  defaultCurrency: string;
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
  ) {}

  async getIntakeSettings(companyId: string): Promise<SalesIntakeSettings> {
    const keys = Object.values(SALES_SETTING_KEYS);
    const values = await this.prisma.setValue.findMany({
      where: {
        defKey: { in: keys },
        scopeKey: `company:${companyId}`,
        deletedAt: null,
      },
    });
    const map = new Map(values.map((v) => [v.defKey, v.valueJson]));

    const asBool = (key: string, fallback: boolean): boolean => {
      const raw = map.get(key);
      if (raw === undefined || raw === null) return fallback;
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'string') return raw === 'true' || raw === '1';
      return Boolean(raw);
    };
    const asString = (key: string, fallback: string): string => {
      const raw = map.get(key);
      if (raw === undefined || raw === null) return fallback;
      return String(raw).replace(/^"|"$/g, '') || fallback;
    };

    return {
      reserveOnConfirm: asBool(
        SALES_SETTING_KEYS.RESERVE_ON_CONFIRM,
        SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.RESERVE_ON_CONFIRM],
      ),
      autoConfirmOnCreate: asBool(
        SALES_SETTING_KEYS.AUTO_CONFIRM_ON_CREATE,
        SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.AUTO_CONFIRM_ON_CREATE],
      ),
      requireRequestedDate: asBool(
        SALES_SETTING_KEYS.REQUIRE_REQUESTED_DATE,
        SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.REQUIRE_REQUESTED_DATE],
      ),
      allowManualPrice: asBool(
        SALES_SETTING_KEYS.ALLOW_MANUAL_PRICE,
        SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.ALLOW_MANUAL_PRICE],
      ),
      defaultCurrency: asString(
        SALES_SETTING_KEYS.DEFAULT_CURRENCY,
        SALES_SETTING_DEFAULTS[SALES_SETTING_KEYS.DEFAULT_CURRENCY],
      ),
    };
  }

  async list(
    companyId: string,
    opts: { q?: string; limit?: number; cursor?: string } = {},
  ): Promise<{ items: SalesOrderDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.SalOrderWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { number: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.salOrder.findMany({
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

  async get(companyId: string, id: string): Promise<SalesOrderDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateSalesOrderDto,
  ): Promise<SalesOrderDto> {
    const settings = await this.getIntakeSettings(companyId);
    if (settings.requireRequestedDate && !dto.requestedDate) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_LINE,
        'requestedDate is required by company settings.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertCustomer(companyId, dto.customerId);
    await this.assertWarehouse(companyId, dto.warehouseId);
    const lineInputs = this.normalizeLines(dto.lines);
    await this.assertProducts(
      companyId,
      lineInputs.map((l) => l.productId),
    );

    const amountTotal = sumLineTotals(lineInputs);
    const number = await this.nextOrderNumber(companyId);
    const currency =
      (dto.currency ?? settings.defaultCurrency).trim() || settings.defaultCurrency;

    const row = await this.prisma.$transaction(async (tx) => {
      const order = await tx.salOrder.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          warehouseId: dto.warehouseId,
          requestedDate: dto.requestedDate
            ? new Date(dto.requestedDate)
            : null,
          currency,
          notes: dto.notes?.trim() || null,
          amountTotal,
          status: SalOrderStatus.DRAFT,
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
        aggregateType: 'sal_order',
        aggregateId: order.id,
        eventType: SALES_EVENT_TYPES.CREATED,
        payloadJson: {
          orderId: order.id,
          number: order.number,
          customerId: order.customerId,
          status: order.status,
          amountTotal: order.amountTotal.toString(),
        },
      });

      return order;
    });

    const shouldConfirm =
      dto.confirmAfter === true ||
      (dto.confirmAfter !== false && settings.autoConfirmOnCreate);
    if (shouldConfirm) {
      return this.confirm(companyId, row.id);
    }

    return this.enrichOne(companyId, row);
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateSalesOrderDto,
  ): Promise<SalesOrderDto> {
    const existing = await this.findActive(companyId, id);
    if (existing.status !== SalOrderStatus.DRAFT) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Only draft orders can be updated.',
        HttpStatus.CONFLICT,
      );
    }
    if (existing.version !== dto.version) {
      throw new SalesException(
        SALES_ERROR_CODES.VERSION_CONFLICT,
        'Order changed concurrently — reload.',
        HttpStatus.CONFLICT,
      );
    }

    const customerId = dto.customerId ?? existing.customerId;
    const warehouseId = dto.warehouseId ?? existing.warehouseId;
    await this.assertCustomer(companyId, customerId);
    await this.assertWarehouse(companyId, warehouseId);

    const lineInputs = dto.lines
      ? this.normalizeLines(dto.lines)
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

    const amountTotal = sumLineTotals(lineInputs);

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salOrder.updateMany({
        where: { id, companyId, version: dto.version, deletedAt: null },
        data: {
          customerId,
          warehouseId,
          requestedDate:
            dto.requestedDate === undefined
              ? undefined
              : dto.requestedDate
                ? new Date(dto.requestedDate)
                : null,
          currency:
            dto.currency !== undefined
              ? dto.currency.trim() || 'TND'
              : undefined,
          notes:
            dto.notes === undefined
              ? undefined
              : dto.notes?.trim() || null,
          amountTotal,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new SalesException(
          SALES_ERROR_CODES.VERSION_CONFLICT,
          'Order changed concurrently — reload.',
          HttpStatus.CONFLICT,
        );
      }

      if (dto.lines) {
        await tx.salOrderLine.deleteMany({ where: { orderId: id, companyId } });
        await tx.salOrderLine.createMany({
          data: lineInputs.map((l, idx) => ({
            companyId,
            orderId: id,
            lineNo: idx + 1,
            productId: l.productId,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discountPct: l.discountPct,
            lineTotal: l.lineTotal,
          })),
        });
      }

      return tx.salOrder.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async confirm(companyId: string, id: string): Promise<SalesOrderDto> {
    const order = await this.findActive(companyId, id);
    if (order.status !== SalOrderStatus.DRAFT) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Only draft orders can be confirmed.',
        HttpStatus.CONFLICT,
      );
    }
    if (order.lines.length === 0) {
      throw new SalesException(
        SALES_ERROR_CODES.EMPTY_LINES,
        'Order has no lines.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.assertCreditPolicy(companyId, order.customerId);
    await this.assertWarehouse(companyId, order.warehouseId);

    const settings = await this.getIntakeSettings(companyId);
    const reserved: { productId: string; qty: number }[] = [];
    if (settings.reserveOnConfirm) {
      try {
        for (const line of order.lines) {
          await this.inventory.reserve(companyId, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            qty: Number(line.qty.toString()),
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
          reserved.push({
            productId: line.productId,
            qty: Number(line.qty.toString()),
          });
        }
      } catch (err) {
        for (const r of reserved.reverse()) {
          try {
            await this.inventory.release(companyId, {
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
        if (err instanceof SalesException) throw err;
        const message =
          err instanceof Error ? err.message : 'Stock reservation failed.';
        throw new SalesException(
          SALES_ERROR_CODES.STOCK_RESERVE_FAILED,
          message,
          HttpStatus.CONFLICT,
        );
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.salOrder.updateMany({
        where: {
          id,
          companyId,
          status: SalOrderStatus.DRAFT,
          deletedAt: null,
        },
        data: {
          status: SalOrderStatus.CONFIRMED,
          confirmedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        for (const r of reserved.reverse()) {
          try {
            await this.inventory.release(companyId, {
              productId: r.productId,
              warehouseId: order.warehouseId,
              qty: r.qty,
              refType: SALES_RESERVE_REF_TYPE,
              refId: order.id,
            });
          } catch {
            // best-effort
          }
        }
        throw new SalesException(
          SALES_ERROR_CODES.VERSION_CONFLICT,
          'Order status changed during confirm.',
          HttpStatus.CONFLICT,
        );
      }

      const fresh = await tx.salOrder.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_order',
        aggregateId: fresh.id,
        eventType: SALES_EVENT_TYPES.CONFIRMED,
        payloadJson: {
          orderId: fresh.id,
          number: fresh.number,
          customerId: fresh.customerId,
          warehouseId: fresh.warehouseId,
          amountTotal: fresh.amountTotal.toString(),
          lineCount: fresh.lines.length,
        },
      });

      return fresh;
    });

    return this.enrichOne(companyId, row);
  }

  async cancel(companyId: string, id: string): Promise<SalesOrderDto> {
    const order = await this.findActive(companyId, id);
    if (order.status === SalOrderStatus.CANCELLED) {
      return this.enrichOne(companyId, order);
    }
    if (
      order.status !== SalOrderStatus.DRAFT &&
      order.status !== SalOrderStatus.CONFIRMED
    ) {
      throw new SalesException(
        SALES_ERROR_CODES.INVALID_STATUS,
        'Order cannot be cancelled.',
        HttpStatus.CONFLICT,
      );
    }

    if (order.status === SalOrderStatus.CONFIRMED) {
      const settings = await this.getIntakeSettings(companyId);
      if (settings.reserveOnConfirm) {
        for (const line of order.lines) {
          await this.inventory.release(companyId, {
            productId: line.productId,
            warehouseId: order.warehouseId,
            qty: Number(line.qty.toString()),
            refType: SALES_RESERVE_REF_TYPE,
            refId: order.id,
          });
        }
      }
    }

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.salOrder.updateMany({
        where: { id, companyId, deletedAt: null },
        data: {
          status: SalOrderStatus.CANCELLED,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      const fresh = await tx.salOrder.findFirstOrThrow({
        where: { id, companyId },
        include: { lines: { orderBy: { lineNo: 'asc' } } },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'sal_order',
        aggregateId: fresh.id,
        eventType: SALES_EVENT_TYPES.CANCELLED,
        payloadJson: {
          orderId: fresh.id,
          number: fresh.number,
          previousStatus: order.status,
        },
      });
      return fresh;
    });

    return this.enrichOne(companyId, row);
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<OrderWithLines> {
    const row = await this.prisma.salOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!row) {
      throw new SalesException(
        SALES_ERROR_CODES.NOT_FOUND,
        'Sales order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
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
    return customer;
  }

  /** V0 credit stub: deny only if customer inactive or party blocked. */
  private async assertCreditPolicy(companyId: string, customerId: string) {
    const customer = await this.assertCustomer(companyId, customerId);
    if (customer.status !== CusCustomerStatus.ACTIVE) {
      throw new SalesException(
        SALES_ERROR_CODES.CREDIT_DENIED,
        'Customer is inactive — confirm denied (credit stub).',
        HttpStatus.CONFLICT,
      );
    }
    if (customer.party.status === MdPartyStatus.BLOCKED) {
      throw new SalesException(
        SALES_ERROR_CODES.CUSTOMER_BLOCKED,
        'Customer party is blocked — confirm denied.',
        HttpStatus.CONFLICT,
      );
    }
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

  private normalizeLines(lines: SalesOrderLineInputDto[]): Array<{
    productId: string;
    qty: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    discountPct: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }> {
    if (!lines.length) {
      throw new SalesException(
        SALES_ERROR_CODES.EMPTY_LINES,
        'At least one line is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return lines.map((l) => {
      const qty = new Prisma.Decimal(l.qty);
      const unitPrice = new Prisma.Decimal(l.unitPrice);
      const discountPct = new Prisma.Decimal(l.discountPct ?? 0);
      if (qty.lte(0) || unitPrice.lt(0) || discountPct.lt(0) || discountPct.gt(100)) {
        throw new SalesException(
          SALES_ERROR_CODES.INVALID_LINE,
          'Invalid line quantity, price, or discount.',
          HttpStatus.BAD_REQUEST,
        );
      }
      const lineTotal = qty
        .mul(unitPrice)
        .mul(new Prisma.Decimal(1).sub(discountPct.div(100)));
      return {
        productId: l.productId,
        qty,
        unitPrice,
        discountPct,
        lineTotal,
      };
    });
  }

  private async nextOrderNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;
    const count = await this.prisma.salOrder.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: OrderWithLines[],
  ): Promise<SalesOrderDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const warehouseIds = [...new Set(rows.map((r) => r.warehouseId))];
    const productIds = [
      ...new Set(rows.flatMap((r) => r.lines.map((l) => l.productId))),
    ];

    const [customers, warehouses, products] = await Promise.all([
      this.prisma.cusCustomer.findMany({
        where: { companyId, id: { in: customerIds } },
        include: { party: true },
      }),
      this.prisma.invWarehouse.findMany({
        where: { companyId, id: { in: warehouseIds } },
      }),
      this.prisma.prdProduct.findMany({
        where: { companyId, id: { in: productIds } },
        select: { id: true, sku: true, name: true },
      }),
    ]);

    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));
    const productMap = new Map(products.map((p) => [p.id, p]));

    return rows.map((row) =>
      serializeOrder(
        row,
        customerMap.get(row.customerId),
        warehouseMap.get(row.warehouseId),
        productMap,
      ),
    );
  }

  private async enrichOne(
    companyId: string,
    row: OrderWithLines,
  ): Promise<SalesOrderDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto;
  }
}

function sumLineTotals(
  lines: Array<{ lineTotal: Prisma.Decimal }>,
): Prisma.Decimal {
  return lines.reduce(
    (acc, l) => acc.add(l.lineTotal),
    new Prisma.Decimal(0),
  );
}

function serializeOrder(
  row: OrderWithLines,
  customer?: {
    code: string;
    party: { legalName: string };
  } | null,
  warehouse?: { code: string } | null,
  products?: Map<string, { sku: string; name: string }>,
): SalesOrderDto {
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
    requestedDate: row.requestedDate
      ? row.requestedDate.toISOString().slice(0, 10)
      : null,
    currency: row.currency,
    notes: row.notes,
    amountTotal: row.amountTotal.toString(),
    version: row.version,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
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

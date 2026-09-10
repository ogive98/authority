import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinOpenItem,
  FinOpenItemSide,
  FinOpenItemStatus,
  Prisma,
  SalOrderStatus,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { AllocateOpenItemDto, CreateOpenItemDto } from './finance.dto';
import { FinanceException } from './finance.exception';
import { InvoiceService } from './invoice.service';
import { PromiseService } from './promise.service';

export type OpenItemDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  side: FinOpenItemSide;
  status: FinOpenItemStatus;
  salesOrderId: string | null;
  invoiceId: string | null;
  currency: string;
  amountTotal: string;
  amountOpen: string;
  dueDate: string | null;
  label: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allocations: {
    id: string;
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type CreditSnapshotDto = {
  customerId: string;
  creditLimit: string | null;
  outstandingBalance: string;
  currency: string;
};

/** AR aging buckets — amounts as-recorded TND (D181). */
export type ArAgingBucketDto = {
  key: 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';
  label: string;
  amountOpen: string;
  count: number;
};

export type ArAgingDto = {
  customerId: string;
  asOf: string;
  currency: 'TND';
  totalOpen: string;
  overdueTotal: string;
  buckets: ArAgingBucketDto[];
};

export type CustomerFinancialOverviewDto = {
  customerId: string;
  credit: CreditSnapshotDto;
  aging: ArAgingDto;
  openCount: number;
  overdueCount: number;
  availableCredit: string | null;
  currency: 'TND';
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly invoices: InvoiceService,
    private readonly promises: PromiseService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      status?: string;
      customerId?: string;
      overdue?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: OpenItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const today = startOfUtcDay(new Date());

    const where: Prisma.FinOpenItemWhereInput = {
      companyId,
      deletedAt: null,
      side: FinOpenItemSide.AR,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(status &&
      Object.values(FinOpenItemStatus).includes(status as FinOpenItemStatus)
        ? { status: status as FinOpenItemStatus }
        : {}),
      ...(opts?.overdue
        ? {
            status: {
              in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
            },
            dueDate: { lt: today },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { label: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.finOpenItem.findMany({
      where,
      include: { allocations: { orderBy: { paidAt: 'desc' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  /** Company-wide AR KPIs for Mission Control — real aggregates, TND as-recorded. */
  async homeKpis(companyId: string): Promise<{
    outstandingOpen: string;
    openCount: number;
    overdueCount: number;
    currency: 'TND';
  }> {
    const today = startOfUtcDay(new Date());
    const openWhere: Prisma.FinOpenItemWhereInput = {
      companyId,
      deletedAt: null,
      side: FinOpenItemSide.AR,
      status: {
        in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
      },
    };
    const [sum, openCount, overdueCount] = await Promise.all([
      this.prisma.finOpenItem.aggregate({
        where: openWhere,
        _sum: { amountOpen: true },
      }),
      this.prisma.finOpenItem.count({ where: openWhere }),
      this.prisma.finOpenItem.count({
        where: { ...openWhere, dueDate: { lt: today } },
      }),
    ]);
    return {
      outstandingOpen: (
        sum._sum.amountOpen ?? new Prisma.Decimal(0)
      ).toFixed(3),
      openCount,
      overdueCount,
      currency: 'TND',
    };
  }

  async get(companyId: string, id: string): Promise<OpenItemDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(
    companyId: string,
    dto: CreateOpenItemDto,
  ): Promise<OpenItemDto> {
    await this.assertCustomer(companyId, dto.customerId);
    const amount = round3(dto.amountTotal);
    if (amount <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'amountTotal must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.salesOrderId) {
      await this.assertSalesOrder(
        companyId,
        dto.customerId,
        dto.salesOrderId,
      );
    }

    const number = await this.nextNumber(companyId);
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();

    const row = await this.prisma.$transaction(async (tx) => {
      const item = await tx.finOpenItem.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          side: FinOpenItemSide.AR,
          status: FinOpenItemStatus.OPEN,
          salesOrderId: dto.salesOrderId ?? null,
          currency,
          amountTotal: amount,
          amountOpen: amount,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          label: dto.label?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
        include: { allocations: true },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_open_item',
        aggregateId: item.id,
        eventType: FINANCE_EVENT_TYPES.OPEN_ITEM_CREATED,
        payloadJson: {
          openItemId: item.id,
          number: item.number,
          customerId: item.customerId,
          amountTotal: item.amountTotal.toString(),
        },
      });

      return item;
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * Idempotent AR open item for a delivered sales order (amount as-recorded).
   * Issues commercial invoice + links/creates open item (D072).
   */
  async ensureArForSalesOrder(
    companyId: string,
    input: {
      customerId: string;
      salesOrderId: string;
      amountTotal: number;
      orderNumber?: string | null;
      currency?: string | null;
      shipmentId?: string | null;
      shipmentNumber?: string | null;
    },
  ): Promise<{ outcome: 'created' | 'existing'; item: OpenItemDto }> {
    const { outcome, invoice } =
      await this.invoices.ensureIssuedForSalesOrder(companyId, input);

    const or: Prisma.FinOpenItemWhereInput[] = [];
    if (input.shipmentId) {
      or.push({ invoiceId: invoice.id });
      if (invoice.openItemId) {
        or.push({ id: invoice.openItemId });
      }
    } else {
      or.push({ salesOrderId: input.salesOrderId });
      if (invoice.openItemId) {
        or.push({ id: invoice.openItemId });
      } else if (invoice.id) {
        or.push({ invoiceId: invoice.id });
      }
    }

    const existing = await this.prisma.finOpenItem.findFirst({
      where: {
        companyId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        OR: or,
      },
      include: { allocations: { orderBy: { paidAt: 'desc' } } },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Open item missing after invoice issue.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
    return {
      outcome,
      item: await this.enrichOne(companyId, existing),
    };
  }

  async allocate(
    companyId: string,
    id: string,
    dto: AllocateOpenItemDto,
  ): Promise<OpenItemDto> {
    const pay = round3(dto.amount);
    if (pay <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'amount must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finOpenItem.findFirst({
        where: { id, companyId, deletedAt: null },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.NOT_FOUND,
          'Open item not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status === FinOpenItemStatus.CLOSED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Open item is already closed.',
          HttpStatus.CONFLICT,
        );
      }

      const open = Number(existing.amountOpen);
      if (pay > open + 1e-9) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.OVER_ALLOCATE,
          'Allocation exceeds open amount.',
          HttpStatus.CONFLICT,
        );
      }

      const nextOpen = round3(open - pay);
      const nextStatus =
        nextOpen <= 0
          ? FinOpenItemStatus.CLOSED
          : FinOpenItemStatus.PARTIAL;

      /** Optimistic concurrency — reject if another allocate raced. */
      const locked = await tx.finOpenItem.updateMany({
        where: {
          id,
          companyId,
          deletedAt: null,
          version: existing.version,
          amountOpen: { gte: pay },
          status: { not: FinOpenItemStatus.CLOSED },
        },
        data: {
          amountOpen: Math.max(0, nextOpen),
          status: nextStatus,
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.OVER_ALLOCATE,
          'Allocation conflict — retry.',
          HttpStatus.CONFLICT,
        );
      }

      await tx.finAllocation.create({
        data: {
          companyId,
          openItemId: id,
          amount: pay,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          note: dto.note?.trim() || null,
        },
      });

      const updated = await tx.finOpenItem.findFirstOrThrow({
        where: { id, companyId },
        include: { allocations: { orderBy: { paidAt: 'desc' } } },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_open_item',
        aggregateId: id,
        eventType: FINANCE_EVENT_TYPES.ALLOCATION_RECORDED,
        payloadJson: {
          openItemId: id,
          customerId: existing.customerId,
          amount: pay,
          amountOpen: updated.amountOpen.toString(),
          status: updated.status,
        },
      });

      if (updated.status === FinOpenItemStatus.CLOSED) {
        await this.promises.markKeptForClosedOpenItem(
          tx,
          companyId,
          id,
          existing.customerId,
        );
      }

      return updated;
    });

    return this.enrichOne(companyId, row);
  }

  async creditSnapshot(
    companyId: string,
    customerId: string,
  ): Promise<CreditSnapshotDto> {
    await this.assertCustomer(companyId, customerId);
    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    const agg = await this.prisma.finOpenItem.aggregate({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
      },
      _sum: { amountOpen: true },
    });

    return {
      customerId,
      creditLimit:
        customer?.creditLimit != null ? customer.creditLimit.toFixed(3) : null,
      outstandingBalance: (agg._sum.amountOpen ?? new Prisma.Decimal(0)).toFixed(
        3,
      ),
      currency: 'TND',
    };
  }

  /**
   * AR aging from open items (dueDate vs today UTC).
   * No dueDate → treated as current (not overdue).
   */
  async arAging(
    companyId: string,
    customerId: string,
  ): Promise<ArAgingDto> {
    await this.assertCustomer(companyId, customerId);
    const today = startOfUtcDay(new Date());
    const rows = await this.prisma.finOpenItem.findMany({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
      },
      select: { amountOpen: true, dueDate: true },
    });

    const buckets: Record<
      ArAgingBucketDto['key'],
      { amount: number; count: number }
    > = {
      current: { amount: 0, count: 0 },
      d1_30: { amount: 0, count: 0 },
      d31_60: { amount: 0, count: 0 },
      d61_90: { amount: 0, count: 0 },
      d90_plus: { amount: 0, count: 0 },
    };

    let totalOpen = 0;
    let overdueTotal = 0;

    for (const row of rows) {
      const amt = Number(row.amountOpen);
      if (!(amt > 0)) continue;
      totalOpen = round3(totalOpen + amt);
      const key = agingBucketKey(row.dueDate, today);
      buckets[key].amount = round3(buckets[key].amount + amt);
      buckets[key].count += 1;
      if (key !== 'current') {
        overdueTotal = round3(overdueTotal + amt);
      }
    }

    const labels: Record<ArAgingBucketDto['key'], string> = {
      current: 'Non échu',
      d1_30: '1–30 j',
      d31_60: '31–60 j',
      d61_90: '61–90 j',
      d90_plus: '90+ j',
    };

    return {
      customerId,
      asOf: today.toISOString().slice(0, 10),
      currency: 'TND',
      totalOpen: totalOpen.toFixed(3),
      overdueTotal: overdueTotal.toFixed(3),
      buckets: (
        ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const
      ).map((key) => ({
        key,
        label: labels[key],
        amountOpen: buckets[key].amount.toFixed(3),
        count: buckets[key].count,
      })),
    };
  }

  /** Hub shell: credit + aging + counts (D181). */
  async customerFinancialOverview(
    companyId: string,
    customerId: string,
  ): Promise<CustomerFinancialOverviewDto> {
    const [credit, aging, openCount, overdueCount] = await Promise.all([
      this.creditSnapshot(companyId, customerId),
      this.arAging(companyId, customerId),
      this.prisma.finOpenItem.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
          status: {
            in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
          },
        },
      }),
      this.prisma.finOpenItem.count({
        where: {
          companyId,
          customerId,
          deletedAt: null,
          side: FinOpenItemSide.AR,
          status: {
            in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL],
          },
          dueDate: { lt: startOfUtcDay(new Date()) },
        },
      }),
    ]);

    let availableCredit: string | null = null;
    if (credit.creditLimit != null) {
      availableCredit = round3(
        Number(credit.creditLimit) - Number(credit.outstandingBalance),
      ).toFixed(3);
    }

    return {
      customerId,
      credit,
      aging,
      openCount,
      overdueCount,
      availableCredit,
      currency: 'TND',
    };
  }

  async sumOutstanding(companyId: string, customerId: string): Promise<number> {
    const agg = await this.prisma.finOpenItem.aggregate({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
      },
      _sum: { amountOpen: true },
    });
    return Number(agg._sum.amountOpen ?? 0);
  }

  private async findActive(
    companyId: string,
    id: string,
  ): Promise<FinOpenItem & { allocations: { id: string; amount: Prisma.Decimal; paidAt: Date; note: string | null }[] }> {
    const row = await this.prisma.finOpenItem.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { allocations: { orderBy: { paidAt: 'desc' } } },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Open item not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async assertCustomer(
    companyId: string,
    customerId: string,
  ): Promise<void> {
    const customer = await this.prisma.cusCustomer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.CUSTOMER_NOT_FOUND,
        'Customer not found.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async assertSalesOrder(
    companyId: string,
    customerId: string,
    salesOrderId: string,
  ): Promise<void> {
    const order = await this.prisma.salOrder.findFirst({
      where: {
        id: salesOrderId,
        companyId,
        customerId,
        deletedAt: null,
        status: { in: [SalOrderStatus.CONFIRMED, SalOrderStatus.DRAFT] },
      },
    });
    if (!order) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.ORDER_NOT_FOUND,
        'Sales order not found for customer.',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FIN-${year}-`;
    const count = await this.prisma.finOpenItem.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: Array<
      FinOpenItem & {
        allocations: {
          id: string;
          amount: Prisma.Decimal;
          paidAt: Date;
          note: string | null;
        }[];
      }
    >,
  ): Promise<OpenItemDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await this.prisma.cusCustomer.findMany({
      where: { companyId, id: { in: customerIds }, deletedAt: null },
      include: { party: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));
    return rows.map((row) => {
      const c = map.get(row.customerId);
      return serialize(row, c?.code ?? null, c?.party.legalName ?? null);
    });
  }

  private async enrichOne(
    companyId: string,
    row: FinOpenItem & {
      allocations: {
        id: string;
        amount: Prisma.Decimal;
        paidAt: Date;
        note: string | null;
      }[];
    },
  ): Promise<OpenItemDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function agingBucketKey(
  dueDate: Date | null,
  today: Date,
): ArAgingBucketDto['key'] {
  if (!dueDate) return 'current';
  const due = startOfUtcDay(dueDate);
  if (due.getTime() >= today.getTime()) return 'current';
  const days = Math.floor(
    (today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

function serialize(
  row: FinOpenItem & {
    allocations: {
      id: string;
      amount: Prisma.Decimal;
      paidAt: Date;
      note: string | null;
    }[];
  },
  customerCode: string | null,
  customerName: string | null,
): OpenItemDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    customerId: row.customerId,
    customerCode,
    customerName,
    side: row.side,
    status: row.status,
    salesOrderId: row.salesOrderId,
    invoiceId: row.invoiceId,
    currency: row.currency,
    amountTotal: row.amountTotal.toFixed(3),
    amountOpen: row.amountOpen.toFixed(3),
    dueDate: row.dueDate
      ? row.dueDate.toISOString().slice(0, 10)
      : null,
    label: row.label,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    allocations: row.allocations.map((a) => ({
      id: a.id,
      amount: a.amount.toFixed(3),
      paidAt: a.paidAt.toISOString(),
      note: a.note,
    })),
  };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

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

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      status?: string;
      customerId?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: OpenItemDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();

    const where: Prisma.FinOpenItemWhereInput = {
      companyId,
      deletedAt: null,
      side: FinOpenItemSide.AR,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(status &&
      Object.values(FinOpenItemStatus).includes(status as FinOpenItemStatus)
        ? { status: status as FinOpenItemStatus }
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
          amount: pay,
          amountOpen: updated.amountOpen.toString(),
          status: updated.status,
        },
      });

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

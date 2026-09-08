import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPromiseStatus,
  FinPromiseToPay,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreatePromiseDto } from './finance.dto';
import { FinanceException } from './finance.exception';

export type PromiseDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  openItemId: string;
  openItemNumber: string | null;
  amount: string;
  currency: string;
  promisedDate: string;
  status: FinPromiseStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class PromiseService {
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
      openItemId?: string;
      broken?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: PromiseDto[]; nextCursor: string | null }> {
    await this.breakOverdue(companyId, {
      customerId: opts?.customerId,
      openItemId: opts?.openItemId,
    });

    const take = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const statusFilter = resolveStatusFilter(opts?.status, opts?.broken);

    const rows = await this.prisma.finPromiseToPay.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(opts?.customerId ? { customerId: opts.customerId } : {}),
        ...(opts?.openItemId ? { openItemId: opts.openItemId } : {}),
        ...(opts?.cursor
          ? { createdAt: { lt: new Date(opts.cursor) } }
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
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const page = rows.slice(0, take);
    const nextCursor =
      rows.length > take
        ? page[page.length - 1]!.createdAt.toISOString()
        : null;

    return {
      items: await this.enrichMany(companyId, page),
      nextCursor,
    };
  }

  async get(companyId: string, id: string): Promise<PromiseDto> {
    await this.breakOverdue(companyId, { id });
    const row = await this.prisma.finPromiseToPay.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.PROMISE_NOT_FOUND,
        'Promise not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.enrichOne(companyId, row);
  }

  async create(companyId: string, dto: CreatePromiseDto): Promise<PromiseDto> {
    const amount = round3(dto.amount);
    if (amount <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'amount must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const openItem = await this.prisma.finOpenItem.findFirst({
      where: {
        id: dto.openItemId,
        companyId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
      },
    });
    if (!openItem) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.NOT_FOUND,
        'Open item not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      openItem.status !== FinOpenItemStatus.OPEN &&
      openItem.status !== FinOpenItemStatus.PARTIAL
    ) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Open item must be OPEN or PARTIAL.',
        HttpStatus.CONFLICT,
      );
    }

    const openAmt = Number(openItem.amountOpen);
    if (amount > openAmt + 1e-9) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Promise amount exceeds open amount.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const existingOpen = await this.prisma.finPromiseToPay.findFirst({
      where: {
        companyId,
        openItemId: openItem.id,
        deletedAt: null,
        status: FinPromiseStatus.OPEN,
      },
    });
    if (existingOpen) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.PROMISE_EXISTS,
        'An open promise already exists for this open item.',
        HttpStatus.CONFLICT,
      );
    }

    const promisedDate = startOfUtcDay(new Date(dto.promisedDate));
    const number = await this.nextNumber(companyId);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.finPromiseToPay.create({
        data: {
          companyId,
          number,
          customerId: openItem.customerId,
          openItemId: openItem.id,
          amount,
          currency: openItem.currency,
          promisedDate,
          status: FinPromiseStatus.OPEN,
          notes: dto.notes?.trim() || null,
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_promise_to_pay',
        aggregateId: created.id,
        eventType: FINANCE_EVENT_TYPES.PROMISE_CREATED,
        payloadJson: {
          promiseId: created.id,
          number: created.number,
          customerId: created.customerId,
          openItemId: created.openItemId,
          amount: created.amount.toString(),
          promisedDate: dateOnly(created.promisedDate),
          status: created.status,
        },
      });

      return created;
    });

    return this.enrichOne(companyId, row);
  }

  async cancel(companyId: string, id: string): Promise<PromiseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.finPromiseToPay.findFirst({
        where: { id, companyId, deletedAt: null },
      });
      if (!existing) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.PROMISE_NOT_FOUND,
          'Promise not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status !== FinPromiseStatus.OPEN) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Only OPEN promises can be cancelled.',
          HttpStatus.CONFLICT,
        );
      }

      const updated = await tx.finPromiseToPay.update({
        where: { id },
        data: {
          status: FinPromiseStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_promise_to_pay',
        aggregateId: id,
        eventType: FINANCE_EVENT_TYPES.PROMISE_STATUS,
        payloadJson: {
          promiseId: id,
          customerId: existing.customerId,
          openItemId: existing.openItemId,
          status: FinPromiseStatus.CANCELLED,
          previousStatus: FinPromiseStatus.OPEN,
        },
      });

      return updated;
    });

    return this.enrichOne(companyId, row);
  }

  /**
   * When an open item becomes CLOSED, mark all OPEN promises KEPT.
   * Call inside the same allocation transaction.
   */
  async markKeptForClosedOpenItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    openItemId: string,
    customerId: string,
  ): Promise<void> {
    const openPromises = await tx.finPromiseToPay.findMany({
      where: {
        companyId,
        openItemId,
        deletedAt: null,
        status: FinPromiseStatus.OPEN,
      },
    });
    for (const p of openPromises) {
      await tx.finPromiseToPay.update({
        where: { id: p.id },
        data: {
          status: FinPromiseStatus.KEPT,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_promise_to_pay',
        aggregateId: p.id,
        eventType: FINANCE_EVENT_TYPES.PROMISE_STATUS,
        payloadJson: {
          promiseId: p.id,
          customerId,
          openItemId,
          status: FinPromiseStatus.KEPT,
          previousStatus: FinPromiseStatus.OPEN,
        },
      });
    }
  }

  /** Persist OPEN → BROKEN when promisedDate is before today UTC. */
  async breakOverdue(
    companyId: string,
    scope?: { id?: string; customerId?: string; openItemId?: string },
  ): Promise<number> {
    const today = utcToday();
    const where: Prisma.FinPromiseToPayWhereInput = {
      companyId,
      deletedAt: null,
      status: FinPromiseStatus.OPEN,
      promisedDate: { lt: today },
      ...(scope?.id ? { id: scope.id } : {}),
      ...(scope?.customerId ? { customerId: scope.customerId } : {}),
      ...(scope?.openItemId ? { openItemId: scope.openItemId } : {}),
    };

    const overdue = await this.prisma.finPromiseToPay.findMany({ where });
    if (overdue.length === 0) return 0;

    await this.prisma.$transaction(async (tx) => {
      for (const p of overdue) {
        await tx.finPromiseToPay.update({
          where: { id: p.id },
          data: {
            status: FinPromiseStatus.BROKEN,
            version: { increment: 1 },
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_promise_to_pay',
          aggregateId: p.id,
          eventType: FINANCE_EVENT_TYPES.PROMISE_STATUS,
          payloadJson: {
            promiseId: p.id,
            customerId: p.customerId,
            openItemId: p.openItemId,
            status: FinPromiseStatus.BROKEN,
            previousStatus: FinPromiseStatus.OPEN,
          },
        });
      }
    });

    return overdue.length;
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PTP-${year}-`;
    const count = await this.prisma.finPromiseToPay.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: FinPromiseToPay[],
  ): Promise<PromiseDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const openItemIds = [...new Set(rows.map((r) => r.openItemId))];
    const [customers, openItems] = await Promise.all([
      this.prisma.cusCustomer.findMany({
        where: { companyId, id: { in: customerIds }, deletedAt: null },
        include: { party: true },
      }),
      this.prisma.finOpenItem.findMany({
        where: { companyId, id: { in: openItemIds }, deletedAt: null },
        select: { id: true, number: true },
      }),
    ]);
    const customerMap = new Map(customers.map((c) => [c.id, c]));
    const openMap = new Map(openItems.map((o) => [o.id, o.number]));
    return rows.map((row) => {
      const c = customerMap.get(row.customerId);
      return serializePromise(
        row,
        c?.code ?? null,
        c?.party.legalName ?? null,
        openMap.get(row.openItemId) ?? null,
      );
    });
  }

  private async enrichOne(
    companyId: string,
    row: FinPromiseToPay,
  ): Promise<PromiseDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

function resolveStatusFilter(
  status?: string,
  broken?: boolean,
): FinPromiseStatus | undefined {
  if (broken) return FinPromiseStatus.BROKEN;
  if (!status) return undefined;
  const upper = status.toUpperCase();
  if (
    Object.values(FinPromiseStatus).includes(upper as FinPromiseStatus)
  ) {
    return upper as FinPromiseStatus;
  }
  return undefined;
}

function utcToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function serializePromise(
  row: FinPromiseToPay,
  customerCode: string | null,
  customerName: string | null,
  openItemNumber: string | null,
): PromiseDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    customerId: row.customerId,
    customerCode,
    customerName,
    openItemId: row.openItemId,
    openItemNumber,
    amount: row.amount.toString(),
    currency: row.currency,
    promisedDate: dateOnly(row.promisedDate),
    status: row.status,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

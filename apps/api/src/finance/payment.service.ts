import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinInstrumentStatus,
  FinInstrumentType,
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPayment,
  FinPaymentMethod,
  FinPaymentStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AllocationEngineService,
  nextOpenStatus,
} from './allocation-engine.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type {
  ConfirmAllocationDto,
  CreatePaymentDto,
  SimulateAllocationDto,
  TransitionInstrumentDto,
} from './finance.dto';
import { FinanceException } from './finance.exception';
import { PromiseService } from './promise.service';

export type PaymentDto = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  amount: string;
  amountUnallocated: string;
  currency: string;
  method: FinPaymentMethod;
  status: FinPaymentStatus;
  paymentDate: string;
  accountingDate: string;
  reference: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  instruments: InstrumentDto[];
  allocations: {
    id: string;
    openItemId: string;
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type InstrumentDto = {
  id: string;
  paymentId: string;
  type: FinInstrumentType;
  status: FinInstrumentStatus;
  number: string;
  bankName: string | null;
  holder: string | null;
  amount: string;
  issueDate: string | null;
  receiveDate: string | null;
  dueDate: string | null;
  depositDate: string | null;
  clearedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
};

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly engine: AllocationEngineService,
    private readonly promises: PromiseService,
  ) {}

  async list(
    companyId: string,
    opts?: {
      q?: string;
      customerId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: PaymentDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();

    const where: Prisma.FinPaymentWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      ...(status &&
      Object.values(FinPaymentStatus).includes(status as FinPaymentStatus)
        ? { status: status as FinPaymentStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: 'insensitive' } },
              { reference: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.finPayment.findMany({
      where,
      include: {
        instruments: { where: { deletedAt: null } },
        allocations: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: await this.enrichMany(companyId, page), nextCursor };
  }

  async get(companyId: string, id: string): Promise<PaymentDto> {
    const row = await this.findActive(companyId, id);
    return this.enrichOne(companyId, row);
  }

  async create(companyId: string, dto: CreatePaymentDto): Promise<PaymentDto> {
    await this.assertCustomer(companyId, dto.customerId);
    const amount = round3(dto.amount);
    if (amount <= 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'amount must be positive.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const needsInstrument =
      dto.method === FinPaymentMethod.CHEQUE ||
      dto.method === FinPaymentMethod.BILL_OF_EXCHANGE;
    if (needsInstrument && !dto.instrument) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INSTRUMENT_REQUIRED,
        'Cheque / bill of exchange requires instrument details.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.instrument) {
      const expectedType =
        dto.method === FinPaymentMethod.CHEQUE
          ? FinInstrumentType.CHEQUE
          : dto.method === FinPaymentMethod.BILL_OF_EXCHANGE
            ? FinInstrumentType.BILL_OF_EXCHANGE
            : dto.instrument.type;
      if (
        (dto.method === FinPaymentMethod.CHEQUE ||
          dto.method === FinPaymentMethod.BILL_OF_EXCHANGE) &&
        dto.instrument.type !== expectedType
      ) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INSTRUMENT_REQUIRED,
          'Instrument type must match payment method.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const number = await this.nextNumber(companyId);
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();
    const paymentDate = new Date(dto.paymentDate);
    const accountingDate = dto.accountingDate
      ? new Date(dto.accountingDate)
      : paymentDate;

    const row = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.finPayment.create({
        data: {
          companyId,
          number,
          customerId: dto.customerId,
          amount,
          amountUnallocated: amount,
          currency,
          method: dto.method,
          status: FinPaymentStatus.POSTED,
          paymentDate,
          accountingDate,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });

      if (dto.instrument) {
        await tx.finPaymentInstrument.create({
          data: {
            companyId,
            paymentId: payment.id,
            type: dto.instrument.type,
            status: FinInstrumentStatus.RECEIVED,
            number: dto.instrument.number.trim(),
            bankName: dto.instrument.bankName?.trim() || null,
            holder: dto.instrument.holder?.trim() || null,
            amount: round3(dto.instrument.amount),
            issueDate: dto.instrument.issueDate
              ? new Date(dto.instrument.issueDate)
              : null,
            receiveDate: dto.instrument.receiveDate
              ? new Date(dto.instrument.receiveDate)
              : paymentDate,
            dueDate: dto.instrument.dueDate
              ? new Date(dto.instrument.dueDate)
              : null,
          },
        });
      }

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_payment',
        aggregateId: payment.id,
        eventType: FINANCE_EVENT_TYPES.PAYMENT_POSTED,
        payloadJson: {
          paymentId: payment.id,
          number: payment.number,
          customerId: payment.customerId,
          amount: payment.amount.toString(),
          method: payment.method,
        },
      });

      return tx.finPayment.findFirstOrThrow({
        where: { id: payment.id },
        include: {
          instruments: { where: { deletedAt: null } },
          allocations: true,
        },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async simulate(
    companyId: string,
    paymentId: string,
    dto: SimulateAllocationDto,
  ) {
    const payment = await this.findActive(companyId, paymentId);
    if (payment.status !== FinPaymentStatus.POSTED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Only posted payments can be allocated.',
        HttpStatus.CONFLICT,
      );
    }
    const unalloc = Number(payment.amountUnallocated);
    if (unalloc <= 1e-9) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.ALREADY_ALLOCATED,
        'Payment has no unallocated amount.',
        HttpStatus.CONFLICT,
      );
    }

    const openItems = await this.prisma.finOpenItem.findMany({
      where: {
        companyId,
        customerId: payment.customerId,
        deletedAt: null,
        side: FinOpenItemSide.AR,
        status: { in: [FinOpenItemStatus.OPEN, FinOpenItemStatus.PARTIAL] },
        amountOpen: { gt: 0 },
      },
    });

    return this.engine.simulate({
      policy: dto.policy,
      customerId: payment.customerId,
      paymentAmount: unalloc,
      openItems: openItems.map((o) => ({
        id: o.id,
        number: o.number,
        amountOpen: Number(o.amountOpen),
        dueDate: o.dueDate,
        createdAt: o.createdAt,
      })),
      manualLines: dto.lines,
    });
  }

  async confirm(
    companyId: string,
    paymentId: string,
    dto: ConfirmAllocationDto,
  ): Promise<PaymentDto> {
    const plan = await this.simulate(companyId, paymentId, dto);
    if (plan.lines.length === 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'No allocation lines to apply.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.finPayment.findFirst({
        where: { id: paymentId, companyId, deletedAt: null },
      });
      if (!payment || payment.status !== FinPaymentStatus.POSTED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Payment not allocatable.',
          HttpStatus.CONFLICT,
        );
      }

      let remainingUnalloc = Number(payment.amountUnallocated);
      const note = dto.note?.trim() || `Policy ${dto.policy}`;

      for (const line of plan.lines) {
        const take = round3(line.amount);
        if (take > remainingUnalloc + 1e-9) {
          throw new FinanceException(
            FINANCE_ERROR_CODES.OVER_ALLOCATE,
            'Plan exceeds unallocated amount.',
            HttpStatus.CONFLICT,
          );
        }

        const openItem = await tx.finOpenItem.findFirst({
          where: {
            id: line.openItemId,
            companyId,
            deletedAt: null,
          },
        });
        if (!openItem) {
          throw new FinanceException(
            FINANCE_ERROR_CODES.NOT_FOUND,
            'Open item not found.',
            HttpStatus.NOT_FOUND,
          );
        }
        const openAmt = Number(openItem.amountOpen);
        if (take > openAmt + 1e-9) {
          throw new FinanceException(
            FINANCE_ERROR_CODES.OVER_ALLOCATE,
            'Allocation exceeds open amount.',
            HttpStatus.CONFLICT,
          );
        }

        const nextOpen = round3(openAmt - take);
        const locked = await tx.finOpenItem.updateMany({
          where: {
            id: openItem.id,
            companyId,
            deletedAt: null,
            version: openItem.version,
            amountOpen: { gte: take },
            status: { not: FinOpenItemStatus.CLOSED },
          },
          data: {
            amountOpen: Math.max(0, nextOpen),
            status: nextOpenStatus(nextOpen),
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
            openItemId: openItem.id,
            paymentId,
            amount: take,
            paidAt: new Date(),
            note,
          },
        });

        remainingUnalloc = round3(remainingUnalloc - take);

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_open_item',
          aggregateId: openItem.id,
          eventType: FINANCE_EVENT_TYPES.ALLOCATION_RECORDED,
          payloadJson: {
            openItemId: openItem.id,
            customerId: payment.customerId,
            paymentId,
            amount: take,
            amountOpen: Math.max(0, nextOpen),
            policy: dto.policy,
          },
        });

        if (nextOpenStatus(nextOpen) === FinOpenItemStatus.CLOSED) {
          await this.promises.markKeptForClosedOpenItem(
            tx,
            companyId,
            openItem.id,
            payment.customerId,
          );
        }
      }

      await tx.finPayment.update({
        where: { id: paymentId },
        data: {
          amountUnallocated: Math.max(0, remainingUnalloc),
          version: { increment: 1 },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_payment',
        aggregateId: paymentId,
        eventType: FINANCE_EVENT_TYPES.PAYMENT_ALLOCATED,
        payloadJson: {
          paymentId,
          policy: dto.policy,
          lineCount: plan.lines.length,
          amountAllocated: round3(
            plan.lines.reduce((s, l) => s + l.amount, 0),
          ),
          amountUnallocated: Math.max(0, remainingUnalloc),
        },
      });

      return tx.finPayment.findFirstOrThrow({
        where: { id: paymentId },
        include: {
          instruments: { where: { deletedAt: null } },
          allocations: { orderBy: { paidAt: 'desc' } },
        },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async listInstruments(
    companyId: string,
    opts?: { status?: string; limit?: number },
  ): Promise<{ items: InstrumentDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.finPaymentInstrument.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status &&
        Object.values(FinInstrumentStatus).includes(
          status as FinInstrumentStatus,
        )
          ? { status: status as FinInstrumentStatus }
          : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeInstrument) };
  }

  /**
   * Public reverse (D187) — POSTED → REVERSED, restore AR allocations,
   * cancel non-terminal instruments, emit payment.reversed for Thunder GL.
   */
  async reverse(companyId: string, paymentId: string): Promise<PaymentDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.finPayment.findFirst({
        where: { id: paymentId, companyId, deletedAt: null },
      });
      if (!payment) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.PAYMENT_NOT_FOUND,
          'Payment not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (payment.status === FinPaymentStatus.REVERSED) {
        return tx.finPayment.findFirstOrThrow({
          where: { id: paymentId },
          include: {
            instruments: { where: { deletedAt: null } },
            allocations: { orderBy: { paidAt: 'desc' } },
          },
        });
      }
      if (payment.status !== FinPaymentStatus.POSTED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Only POSTED payments can be reversed.',
          HttpStatus.CONFLICT,
        );
      }

      await this.restoreArOnReject(tx, companyId, paymentId);
      await tx.finPaymentInstrument.updateMany({
        where: {
          companyId,
          paymentId,
          deletedAt: null,
          status: {
            notIn: [
              FinInstrumentStatus.REJECTED,
              FinInstrumentStatus.CANCELLED,
            ],
          },
        },
        data: { status: FinInstrumentStatus.CANCELLED },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_payment',
        aggregateId: paymentId,
        eventType: FINANCE_EVENT_TYPES.PAYMENT_REVERSED,
        payloadJson: {
          paymentId,
          customerId: payment.customerId,
          amount: payment.amount.toString(),
        },
      });

      return tx.finPayment.findFirstOrThrow({
        where: { id: paymentId },
        include: {
          instruments: { where: { deletedAt: null } },
          allocations: { orderBy: { paidAt: 'desc' } },
        },
      });
    });

    return this.enrichOne(companyId, row);
  }

  async transitionInstrument(
    companyId: string,
    instrumentId: string,
    dto: TransitionInstrumentDto,
  ): Promise<InstrumentDto> {
    const next = dto.status;
    const row = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.finPaymentInstrument.findFirst({
        where: { id: instrumentId, companyId, deletedAt: null },
      });
      if (!inst) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INSTRUMENT_NOT_FOUND,
          'Instrument not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (
        inst.status === FinInstrumentStatus.REJECTED ||
        inst.status === FinInstrumentStatus.CANCELLED
      ) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Instrument is terminal.',
          HttpStatus.CONFLICT,
        );
      }
      if (!isAllowedTransition(inst.status, next)) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          `Cannot transition ${inst.status} → ${next}.`,
          HttpStatus.CONFLICT,
        );
      }

      if (next === FinInstrumentStatus.REJECTED) {
        await this.restoreArOnReject(tx, companyId, inst.paymentId);
        const updated = await tx.finPaymentInstrument.update({
          where: { id: instrumentId },
          data: {
            status: next,
            rejectedAt: new Date(),
            rejectReason: dto.rejectReason?.trim() || null,
            version: { increment: 1 },
          },
        });
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'fin_payment_instrument',
          aggregateId: instrumentId,
          eventType: FINANCE_EVENT_TYPES.INSTRUMENT_REJECTED,
          payloadJson: {
            instrumentId,
            paymentId: inst.paymentId,
            reason: dto.rejectReason ?? null,
          },
        });
        return updated;
      }

      const updated = await tx.finPaymentInstrument.update({
        where: { id: instrumentId },
        data: {
          status: next,
          depositDate:
            next === FinInstrumentStatus.DEPOSITED
              ? new Date()
              : inst.depositDate,
          clearedAt:
            next === FinInstrumentStatus.CLEARED ? new Date() : inst.clearedAt,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'fin_payment_instrument',
        aggregateId: instrumentId,
        eventType: FINANCE_EVENT_TYPES.INSTRUMENT_STATUS,
        payloadJson: {
          instrumentId,
          paymentId: inst.paymentId,
          status: next,
        },
      });
      return updated;
    });

    return serializeInstrument(row);
  }

  /**
   * Reverse all allocations on the payment and restore open amounts.
   * Marks payment REVERSED; leftover unallocated becomes full amount.
   */
  private async restoreArOnReject(
    tx: Prisma.TransactionClient,
    companyId: string,
    paymentId: string,
  ): Promise<void> {
    const payment = await tx.finPayment.findFirst({
      where: { id: paymentId, companyId, deletedAt: null },
    });
    if (!payment) return;
    if (payment.status === FinPaymentStatus.REVERSED) return;

    const allocations = await tx.finAllocation.findMany({
      where: { companyId, paymentId },
    });

    for (const alloc of allocations) {
      const openItem = await tx.finOpenItem.findFirst({
        where: { id: alloc.openItemId, companyId, deletedAt: null },
      });
      if (!openItem) continue;
      const restored = round3(
        Number(openItem.amountOpen) + Number(alloc.amount),
      );
      const capped = round3(
        Math.min(restored, Number(openItem.amountTotal)),
      );
      await tx.finOpenItem.update({
        where: { id: openItem.id },
        data: {
          amountOpen: capped,
          status:
            capped <= 1e-9
              ? FinOpenItemStatus.CLOSED
              : capped + 1e-9 >= Number(openItem.amountTotal)
                ? FinOpenItemStatus.OPEN
                : FinOpenItemStatus.PARTIAL,
          version: { increment: 1 },
        },
      });
      await tx.finAllocation.delete({ where: { id: alloc.id } });
    }

    await tx.finPayment.update({
      where: { id: paymentId },
      data: {
        status: FinPaymentStatus.REVERSED,
        amountUnallocated: payment.amount,
        version: { increment: 1 },
      },
    });
  }

  private async findActive(companyId: string, id: string) {
    const row = await this.prisma.finPayment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        instruments: { where: { deletedAt: null } },
        allocations: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.PAYMENT_NOT_FOUND,
        'Payment not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async assertCustomer(companyId: string, customerId: string) {
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

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const count = await this.prisma.finPayment.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private async enrichMany(
    companyId: string,
    rows: Array<
      FinPayment & {
        instruments: Parameters<typeof serializeInstrument>[0][];
        allocations: {
          id: string;
          openItemId: string;
          amount: Prisma.Decimal;
          paidAt: Date;
          note: string | null;
        }[];
      }
    >,
  ): Promise<PaymentDto[]> {
    if (rows.length === 0) return [];
    const customerIds = [...new Set(rows.map((r) => r.customerId))];
    const customers = await this.prisma.cusCustomer.findMany({
      where: { companyId, id: { in: customerIds }, deletedAt: null },
      include: { party: true },
    });
    const map = new Map(customers.map((c) => [c.id, c]));
    return rows.map((row) => {
      const c = map.get(row.customerId);
      return serializePayment(
        row,
        c?.code ?? null,
        c?.party.legalName ?? null,
      );
    });
  }

  private async enrichOne(
    companyId: string,
    row: FinPayment & {
      instruments: Parameters<typeof serializeInstrument>[0][];
      allocations: {
        id: string;
        openItemId: string;
        amount: Prisma.Decimal;
        paidAt: Date;
        note: string | null;
      }[];
    },
  ): Promise<PaymentDto> {
    const [dto] = await this.enrichMany(companyId, [row]);
    return dto!;
  }
}

function isAllowedTransition(
  from: FinInstrumentStatus,
  to: FinInstrumentStatus,
): boolean {
  const map: Record<FinInstrumentStatus, FinInstrumentStatus[]> = {
    RECEIVED: [
      FinInstrumentStatus.DEPOSITED,
      FinInstrumentStatus.PRESENTED,
      FinInstrumentStatus.REJECTED,
      FinInstrumentStatus.CANCELLED,
    ],
    DEPOSITED: [
      FinInstrumentStatus.PRESENTED,
      FinInstrumentStatus.CLEARED,
      FinInstrumentStatus.REJECTED,
    ],
    PRESENTED: [
      FinInstrumentStatus.CLEARED,
      FinInstrumentStatus.REJECTED,
    ],
    CLEARED: [],
    REJECTED: [],
    CANCELLED: [],
  };
  return map[from]?.includes(to) ?? false;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function serializeInstrument(row: {
  id: string;
  paymentId: string;
  type: FinInstrumentType;
  status: FinInstrumentStatus;
  number: string;
  bankName: string | null;
  holder: string | null;
  amount: Prisma.Decimal;
  issueDate: Date | null;
  receiveDate: Date | null;
  dueDate: Date | null;
  depositDate: Date | null;
  clearedAt: Date | null;
  rejectedAt: Date | null;
  rejectReason: string | null;
}): InstrumentDto {
  return {
    id: row.id,
    paymentId: row.paymentId,
    type: row.type,
    status: row.status,
    number: row.number,
    bankName: row.bankName,
    holder: row.holder,
    amount: row.amount.toFixed(3),
    issueDate: row.issueDate
      ? row.issueDate.toISOString().slice(0, 10)
      : null,
    receiveDate: row.receiveDate
      ? row.receiveDate.toISOString().slice(0, 10)
      : null,
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    depositDate: row.depositDate
      ? row.depositDate.toISOString().slice(0, 10)
      : null,
    clearedAt: row.clearedAt?.toISOString() ?? null,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectReason: row.rejectReason,
  };
}

function serializePayment(
  row: FinPayment & {
    instruments: Parameters<typeof serializeInstrument>[0][];
    allocations: {
      id: string;
      openItemId: string;
      amount: Prisma.Decimal;
      paidAt: Date;
      note: string | null;
    }[];
  },
  customerCode: string | null,
  customerName: string | null,
): PaymentDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    customerId: row.customerId,
    customerCode,
    customerName,
    amount: row.amount.toFixed(3),
    amountUnallocated: row.amountUnallocated.toFixed(3),
    currency: row.currency,
    method: row.method,
    status: row.status,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    accountingDate: row.accountingDate.toISOString().slice(0, 10),
    reference: row.reference,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    instruments: row.instruments.map(serializeInstrument),
    allocations: row.allocations.map((a) => ({
      id: a.id,
      openItemId: a.openItemId,
      amount: a.amount.toFixed(3),
      paidAt: a.paidAt.toISOString(),
      note: a.note,
    })),
  };
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { FinApBillStatus, Prisma } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreateApBillDto } from './finance.dto';
import { FinanceException } from './finance.exception';

export type ApBillPaymentSummary = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  method: string;
  paymentDate: string;
  matched: boolean;
};

export type ApBillDto = {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  status: FinApBillStatus;
  billDate: string;
  dueDate: string | null;
  amountTotal: string;
  currency: string;
  label: string | null;
  reference: string | null;
  notes: string | null;
  version: number;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Present on get (D237). */
  payments?: ApBillPaymentSummary[];
  amountPaid?: string;
};

@Injectable()
export class ApBillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts?: { q?: string; status?: string; limit?: number },
  ): Promise<{ items: ApBillDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.finApBill.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(status &&
        Object.values(FinApBillStatus).includes(status as FinApBillStatus)
          ? { status: status as FinApBillStatus }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { vendorName: { contains: q, mode: 'insensitive' } },
                { label: { contains: q, mode: 'insensitive' } },
                { reference: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ billDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map((row) => serializeApBill(row)) };
  }

  async get(companyId: string, id: string): Promise<ApBillDto> {
    const row = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        payments: {
          where: { deletedAt: null },
          orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
          include: { bankMatches: { select: { id: true } } },
        },
      },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return serializeApBill(row, true);
  }

  async create(companyId: string, dto: CreateApBillDto): Promise<ApBillDto> {
    assertPositiveAmount(dto.amountTotal);
    const amountTotal = round3(dto.amountTotal);
    const vendorName = dto.vendorName.trim();
    if (!vendorName) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_POLICY,
        'vendorName is required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const number = await this.nextNumber(companyId);
    const billDate = new Date(`${dto.billDate.slice(0, 10)}T00:00:00.000Z`);
    const dueDate = dto.dueDate
      ? new Date(`${dto.dueDate.slice(0, 10)}T00:00:00.000Z`)
      : null;

    const row = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.finApBill.create({
        data: {
          companyId,
          number,
          vendorName,
          status: FinApBillStatus.DRAFT,
          billDate,
          dueDate,
          amountTotal,
          currency: (dto.currency?.trim() || 'TND').toUpperCase(),
          label: dto.label?.trim() || null,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_CREATED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          vendorName: bill.vendorName,
          amountTotal: bill.amountTotal.toString(),
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  async post(companyId: string, id: string): Promise<ApBillDto> {
    const existing = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status !== FinApBillStatus.DRAFT) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Only DRAFT AP bills can be posted.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.finApBill.update({
        where: { id: existing.id },
        data: {
          status: FinApBillStatus.POSTED,
          postedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_POSTED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          vendorName: bill.vendorName,
          amountTotal: bill.amountTotal.toString(),
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  async cancel(companyId: string, id: string): Promise<ApBillDto> {
    const existing = await this.prisma.finApBill.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
        'AP bill not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status === FinApBillStatus.CANCELLED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'AP bill already cancelled.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.$transaction(async (tx) => {
      const bill = await tx.finApBill.update({
        where: { id: existing.id },
        data: {
          status: FinApBillStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_BILL_CANCELLED,
        aggregateType: 'fin_ap_bill',
        aggregateId: bill.id,
        payloadJson: {
          billId: bill.id,
          number: bill.number,
          priorStatus: existing.status,
        },
      });
      return bill;
    });

    return serializeApBill(row);
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `APB-${year}-`;
    const last = await this.prisma.finApBill.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = last?.number
      ? Number(last.number.slice(prefix.length)) + 1
      : 1;
    return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, '0')}`;
  }
}

function assertPositiveAmount(amount: number) {
  if (!(amount > 0) || !Number.isFinite(amount)) {
    throw new FinanceException(
      FINANCE_ERROR_CODES.INVALID_AMOUNT,
      'amountTotal must be > 0.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function round3(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(3));
}

function serializeApBill(
  row: {
    id: string;
    companyId: string;
    number: string;
    vendorName: string;
    status: FinApBillStatus;
    billDate: Date;
    dueDate: Date | null;
    amountTotal: Prisma.Decimal;
    currency: string;
    label: string | null;
    reference: string | null;
    notes: string | null;
    version: number;
    postedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    payments?: {
      id: string;
      number: string;
      amount: Prisma.Decimal;
      currency: string;
      method: string;
      paymentDate: Date;
      bankMatches: { id: string }[];
    }[];
  },
  withPayments = false,
): ApBillDto {
  const base: ApBillDto = {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    vendorName: row.vendorName,
    status: row.status,
    billDate: row.billDate.toISOString().slice(0, 10),
    dueDate: row.dueDate ? row.dueDate.toISOString().slice(0, 10) : null,
    amountTotal: row.amountTotal.toFixed(3),
    currency: row.currency,
    label: row.label,
    reference: row.reference,
    notes: row.notes,
    version: row.version,
    postedAt: row.postedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (!withPayments) return base;
  const payments = (row.payments ?? []).map((p) => ({
    id: p.id,
    number: p.number,
    amount: p.amount.toFixed(3),
    currency: p.currency,
    method: p.method,
    paymentDate: p.paymentDate.toISOString().slice(0, 10),
    matched: p.bankMatches.length > 0,
  }));
  const paid = (row.payments ?? []).reduce(
    (sum, p) => sum + Number(p.amount.toFixed(3)),
    0,
  );
  return {
    ...base,
    payments,
    amountPaid: paid.toFixed(3),
  };
}

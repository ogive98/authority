import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinApBillStatus,
  FinPaymentMethod,
  FinPaymentStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type { CreateApPaymentDto } from './finance.dto';
import { FinanceException } from './finance.exception';

export type ApPaymentDto = {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  amount: string;
  currency: string;
  method: FinPaymentMethod;
  status: FinPaymentStatus;
  paymentDate: string;
  accountingDate: string;
  reference: string | null;
  notes: string | null;
  apBillId: string | null;
  apBillNumber: string | null;
  version: number;
  matched: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ApPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(
    companyId: string,
    opts?: { q?: string; status?: string; apBillId?: string; limit?: number },
  ): Promise<{ items: ApPaymentDto[] }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const status = opts?.status?.trim().toUpperCase();
    const apBillId = opts?.apBillId?.trim();
    const rows = await this.prisma.finApPayment.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(apBillId ? { apBillId } : {}),
        ...(status &&
        Object.values(FinPaymentStatus).includes(status as FinPaymentStatus)
          ? { status: status as FinPaymentStatus }
          : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' } },
                { vendorName: { contains: q, mode: 'insensitive' } },
                { reference: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        bankMatches: { select: { id: true } },
        apBill: { select: { number: true } },
      },
      orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeApPayment) };
  }

  async create(
    companyId: string,
    dto: CreateApPaymentDto,
  ): Promise<ApPaymentDto> {
    assertPositiveApAmount(dto.amount);
    const amount = round3(dto.amount);

    let apBillId: string | null = null;
    let vendorName = dto.vendorName?.trim() ?? '';

    if (dto.apBillId) {
      const bill = await this.prisma.finApBill.findFirst({
        where: { id: dto.apBillId, companyId, deletedAt: null },
      });
      if (!bill) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.AP_BILL_NOT_FOUND,
          'AP bill not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (bill.status !== FinApBillStatus.POSTED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Only POSTED AP bills can be linked to a disbursement.',
          HttpStatus.CONFLICT,
        );
      }
      apBillId = bill.id;
      if (!vendorName) vendorName = bill.vendorName;
    }

    if (!vendorName) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_POLICY,
        'vendorName is required (or link a POSTED AP bill).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const number = await this.nextNumber(companyId);
    const paymentDate = new Date(dto.paymentDate);
    const accountingDate = dto.accountingDate
      ? new Date(dto.accountingDate)
      : paymentDate;
    const currency = (dto.currency?.trim() || 'TND').toUpperCase();

    const row = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.finApPayment.create({
        data: {
          companyId,
          number,
          vendorName,
          amount,
          currency,
          method: dto.method,
          status: FinPaymentStatus.POSTED,
          paymentDate,
          accountingDate,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
          apBillId,
        },
        include: {
          bankMatches: { select: { id: true } },
          apBill: { select: { number: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.AP_PAYMENT_POSTED,
        aggregateType: 'fin_ap_payment',
        aggregateId: payment.id,
        payloadJson: {
          apPaymentId: payment.id,
          number,
          vendorName,
          amount: amount.toFixed(3),
          currency,
          paymentDate: paymentDate.toISOString().slice(0, 10),
          apBillId,
        },
      });
      return payment;
    });

    return serializeApPayment(row);
  }

  private async nextNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AP-${year}-`;
    const count = await this.prisma.finApPayment.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

export function assertPositiveApAmount(amount: number): void {
  if (!Number.isFinite(amount) || round3(amount) <= 0) {
    throw new FinanceException(
      FINANCE_ERROR_CODES.INVALID_AMOUNT,
      'amount must be positive.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

function serializeApPayment(row: {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  amount: Prisma.Decimal;
  currency: string;
  method: FinPaymentMethod;
  status: FinPaymentStatus;
  paymentDate: Date;
  accountingDate: Date;
  reference: string | null;
  notes: string | null;
  apBillId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  bankMatches: { id: string }[];
  apBill: { number: string } | null;
}): ApPaymentDto {
  return {
    id: row.id,
    companyId: row.companyId,
    number: row.number,
    vendorName: row.vendorName,
    amount: row.amount.toFixed(3),
    currency: row.currency,
    method: row.method,
    status: row.status,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    accountingDate: row.accountingDate.toISOString().slice(0, 10),
    reference: row.reference,
    notes: row.notes,
    apBillId: row.apBillId,
    apBillNumber: row.apBill?.number ?? null,
    version: row.version,
    matched: row.bankMatches.length > 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

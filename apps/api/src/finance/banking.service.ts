import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinBankLineStatus,
  FinInstrumentStatus,
  FinPaymentStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FINANCE_ERROR_CODES,
  FINANCE_EVENT_TYPES,
} from './finance.constants';
import type {
  CreateBankAccountDto,
  CreateBankStatementLineDto,
  CreateBankStatementLinesDto,
  MatchBankLineDto,
  UpdateBankAccountDto,
} from './finance.dto';
import { FinanceException } from './finance.exception';

/** Pure guard — payment XOR instrument. */
export function assertXorMatchTarget(input: {
  paymentId?: string;
  instrumentId?: string;
}): void {
  const hasPayment = Boolean(input.paymentId);
  const hasInstrument = Boolean(input.instrumentId);
  if (hasPayment === hasInstrument) {
    throw new FinanceException(
      FINANCE_ERROR_CODES.BANK_MATCH_TARGET,
      'Provide exactly one of paymentId or instrumentId.',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export type BankAccountDto = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  bankName: string | null;
  rib: string | null;
  iban: string | null;
  glAccountCode: string | null;
  currency: string;
  active: boolean;
  isDefault: boolean;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  unmatchedCount: number;
};

export type BankMatchDto = {
  id: string;
  paymentId: string | null;
  instrumentId: string | null;
  note: string | null;
  matchedAt: string;
  paymentNumber: string | null;
  instrumentNumber: string | null;
};

export type BankStatementLineDto = {
  id: string;
  companyId: string;
  bankAccountId: string;
  lineDate: string;
  amount: string;
  currency: string;
  reference: string | null;
  counterparty: string | null;
  memo: string | null;
  status: FinBankLineStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  match: BankMatchDto | null;
};

@Injectable()
export class BankingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listAccounts(companyId: string): Promise<{ items: BankAccountDto[] }> {
    const rows = await this.prisma.finBankAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    const unmatched = await this.prisma.finBankStatementLine.groupBy({
      by: ['bankAccountId'],
      where: {
        companyId,
        deletedAt: null,
        status: FinBankLineStatus.UNMATCHED,
      },
      _count: { _all: true },
    });
    const countMap = new Map(
      unmatched.map((u) => [u.bankAccountId, u._count._all]),
    );
    return {
      items: rows.map((r) => serializeAccount(r, countMap.get(r.id) ?? 0)),
    };
  }

  async createAccount(
    companyId: string,
    dto: CreateBankAccountDto,
  ): Promise<BankAccountDto> {
    const code = dto.code.trim().toUpperCase();
    if (!code) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Bank account code required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const existing = await this.prisma.finBankAccount.findFirst({
      where: { companyId, code, deletedAt: null },
    });
    if (existing) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        `Bank account code ${code} already exists.`,
        HttpStatus.CONFLICT,
      );
    }
    const makeDefault = dto.isDefault === true;
    const row = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.finBankAccount.updateMany({
          where: { companyId, deletedAt: null, isDefault: true },
          data: { isDefault: false, version: { increment: 1 } },
        });
      }
      const activeCount = await tx.finBankAccount.count({
        where: { companyId, deletedAt: null },
      });
      return tx.finBankAccount.create({
        data: {
          companyId,
          code,
          label: dto.label.trim(),
          bankName: dto.bankName?.trim() || null,
          rib: dto.rib?.trim() || null,
          iban: dto.iban?.trim() || null,
          glAccountCode: dto.glAccountCode?.trim() || null,
          isDefault: makeDefault || activeCount === 0,
          notes: dto.notes?.trim() || null,
        },
      });
    });
    return serializeAccount(row, 0);
  }

  async updateAccount(
    companyId: string,
    id: string,
    dto: UpdateBankAccountDto,
  ): Promise<BankAccountDto> {
    const current = await this.requireAccount(companyId, id);
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.finBankAccount.updateMany({
          where: {
            companyId,
            deletedAt: null,
            isDefault: true,
            id: { not: id },
          },
          data: { isDefault: false, version: { increment: 1 } },
        });
      }
      return tx.finBankAccount.update({
        where: { id: current.id },
        data: {
          label: dto.label?.trim() ?? undefined,
          bankName:
            dto.bankName === undefined
              ? undefined
              : dto.bankName.trim() || null,
          rib: dto.rib === undefined ? undefined : dto.rib.trim() || null,
          iban: dto.iban === undefined ? undefined : dto.iban.trim() || null,
          glAccountCode:
            dto.glAccountCode === undefined
              ? undefined
              : dto.glAccountCode.trim() || null,
          active: dto.active,
          isDefault: dto.isDefault,
          notes:
            dto.notes === undefined ? undefined : dto.notes.trim() || null,
          version: { increment: 1 },
        },
      });
    });
    const unmatched = await this.prisma.finBankStatementLine.count({
      where: {
        companyId,
        bankAccountId: id,
        deletedAt: null,
        status: FinBankLineStatus.UNMATCHED,
      },
    });
    return serializeAccount(row, unmatched);
  }

  async listLines(
    companyId: string,
    bankAccountId: string,
    opts?: { status?: string; limit?: number },
  ): Promise<{ items: BankStatementLineDto[] }> {
    await this.requireAccount(companyId, bankAccountId);
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);
    const status = opts?.status?.trim().toUpperCase();
    const statusFilter =
      status &&
      Object.values(FinBankLineStatus).includes(status as FinBankLineStatus)
        ? (status as FinBankLineStatus)
        : undefined;
    const rows = await this.prisma.finBankStatementLine.findMany({
      where: {
        companyId,
        bankAccountId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: {
        match: {
          include: {
            payment: { select: { number: true } },
            instrument: { select: { number: true } },
          },
        },
      },
      orderBy: [{ lineDate: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
    return { items: rows.map(serializeLine) };
  }

  async addLines(
    companyId: string,
    bankAccountId: string,
    dto: CreateBankStatementLinesDto,
  ): Promise<{ items: BankStatementLineDto[] }> {
    await this.requireAccount(companyId, bankAccountId);
    if (!dto.lines?.length) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'At least one statement line required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const line of dto.lines) {
        out.push(await this.createLineTx(tx, companyId, bankAccountId, line));
      }
      return out;
    });
    return {
      items: created.map((r) =>
        serializeLine({ ...r, match: null }),
      ),
    };
  }

  async matchLine(
    companyId: string,
    lineId: string,
    dto: MatchBankLineDto,
  ): Promise<BankStatementLineDto> {
    assertXorMatchTarget(dto);

    const line = await this.prisma.finBankStatementLine.findFirst({
      where: { id: lineId, companyId, deletedAt: null },
      include: { match: true },
    });
    if (!line) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_LINE_NOT_FOUND,
        'Statement line not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (line.status === FinBankLineStatus.MATCHED || line.match) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_ALREADY_MATCHED,
        'Statement line already matched.',
        HttpStatus.CONFLICT,
      );
    }
    if (line.status === FinBankLineStatus.IGNORED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Ignored line cannot be matched.',
        HttpStatus.CONFLICT,
      );
    }

    const absLine = line.amount.abs();

    if (dto.paymentId) {
      const payment = await this.prisma.finPayment.findFirst({
        where: { id: dto.paymentId, companyId, deletedAt: null },
        include: { bankMatches: true },
      });
      if (!payment) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.PAYMENT_NOT_FOUND,
          'Payment not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (payment.status !== FinPaymentStatus.POSTED) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Only POSTED payments can be matched.',
          HttpStatus.CONFLICT,
        );
      }
      if (payment.bankMatches.length > 0) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.BANK_ALREADY_MATCHED,
          'Payment already matched to a bank line.',
          HttpStatus.CONFLICT,
        );
      }
      if (!payment.amount.equals(absLine)) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.BANK_AMOUNT_MISMATCH,
          'Payment amount does not match statement line.',
          HttpStatus.CONFLICT,
          {
            lineAmount: absLine.toFixed(3),
            paymentAmount: payment.amount.toFixed(3),
          },
        );
      }
    }

    if (dto.instrumentId) {
      const instrument = await this.prisma.finPaymentInstrument.findFirst({
        where: { id: dto.instrumentId, companyId, deletedAt: null },
        include: { bankMatches: true },
      });
      if (!instrument) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INSTRUMENT_NOT_FOUND,
          'Instrument not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (
        instrument.status === FinInstrumentStatus.REJECTED ||
        instrument.status === FinInstrumentStatus.CANCELLED
      ) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.INVALID_STATUS,
          'Rejected/cancelled instruments cannot be matched.',
          HttpStatus.CONFLICT,
        );
      }
      if (instrument.bankMatches.length > 0) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.BANK_ALREADY_MATCHED,
          'Instrument already matched to a bank line.',
          HttpStatus.CONFLICT,
        );
      }
      if (!instrument.amount.equals(absLine)) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.BANK_AMOUNT_MISMATCH,
          'Instrument amount does not match statement line.',
          HttpStatus.CONFLICT,
          {
            lineAmount: absLine.toFixed(3),
            instrumentAmount: instrument.amount.toFixed(3),
          },
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.finBankMatch.create({
        data: {
          companyId,
          statementLineId: line.id,
          paymentId: dto.paymentId ?? null,
          instrumentId: dto.instrumentId ?? null,
          note: dto.note?.trim() || null,
        },
      });
      const row = await tx.finBankStatementLine.update({
        where: { id: line.id },
        data: {
          status: FinBankLineStatus.MATCHED,
          version: { increment: 1 },
        },
        include: {
          match: {
            include: {
              payment: { select: { number: true } },
              instrument: { select: { number: true } },
            },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.BANK_MATCHED,
        aggregateType: 'fin_bank_statement_line',
        aggregateId: line.id,
        payloadJson: {
          statementLineId: line.id,
          bankAccountId: line.bankAccountId,
          paymentId: dto.paymentId ?? null,
          instrumentId: dto.instrumentId ?? null,
          amount: absLine.toFixed(3),
        },
      });
      return row;
    });

    return serializeLine(updated);
  }

  async unmatchLine(
    companyId: string,
    lineId: string,
  ): Promise<BankStatementLineDto> {
    const line = await this.prisma.finBankStatementLine.findFirst({
      where: { id: lineId, companyId, deletedAt: null },
      include: { match: true },
    });
    if (!line) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_LINE_NOT_FOUND,
        'Statement line not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!line.match) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Statement line is not matched.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.finBankMatch.delete({ where: { id: line.match!.id } });
      const row = await tx.finBankStatementLine.update({
        where: { id: line.id },
        data: {
          status: FinBankLineStatus.UNMATCHED,
          version: { increment: 1 },
        },
        include: {
          match: {
            include: {
              payment: { select: { number: true } },
              instrument: { select: { number: true } },
            },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: FINANCE_EVENT_TYPES.BANK_UNMATCHED,
        aggregateType: 'fin_bank_statement_line',
        aggregateId: line.id,
        payloadJson: {
          statementLineId: line.id,
          bankAccountId: line.bankAccountId,
          priorPaymentId: line.match!.paymentId,
          priorInstrumentId: line.match!.instrumentId,
        },
      });
      return row;
    });

    return serializeLine(updated);
  }

  /** Candidates with exact absolute amount, not yet matched (AR V0). */
  async matchCandidates(
    companyId: string,
    lineId: string,
  ): Promise<{
    line: BankStatementLineDto;
    payments: {
      id: string;
      number: string;
      amount: string;
      method: string;
      paymentDate: string;
      customerName: string | null;
      reference: string | null;
    }[];
    instruments: {
      id: string;
      number: string;
      type: string;
      status: string;
      amount: string;
      paymentId: string;
      paymentNumber: string;
      bankName: string | null;
    }[];
  }> {
    const line = await this.prisma.finBankStatementLine.findFirst({
      where: { id: lineId, companyId, deletedAt: null },
      include: {
        match: {
          include: {
            payment: { select: { number: true } },
            instrument: { select: { number: true } },
          },
        },
      },
    });
    if (!line) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_LINE_NOT_FOUND,
        'Statement line not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const abs = line.amount.abs();
    const matchedPaymentIds = (
      await this.prisma.finBankMatch.findMany({
        where: { companyId, paymentId: { not: null } },
        select: { paymentId: true },
      })
    )
      .map((m) => m.paymentId!)
      .filter(Boolean);
    const matchedInstrumentIds = (
      await this.prisma.finBankMatch.findMany({
        where: { companyId, instrumentId: { not: null } },
        select: { instrumentId: true },
      })
    )
      .map((m) => m.instrumentId!)
      .filter(Boolean);

    const payments = await this.prisma.finPayment.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: FinPaymentStatus.POSTED,
        amount: abs,
        id: { notIn: matchedPaymentIds.length ? matchedPaymentIds : undefined },
      },
      orderBy: { paymentDate: 'desc' },
      take: 40,
    });
    const customerIds = [...new Set(payments.map((p) => p.customerId))];
    const customers = customerIds.length
      ? await this.prisma.cusCustomer.findMany({
          where: { companyId, id: { in: customerIds }, deletedAt: null },
          include: { party: true },
        })
      : [];
    const custMap = new Map(
      customers.map((c) => [c.id, c.party.legalName ?? null]),
    );

    const instruments = await this.prisma.finPaymentInstrument.findMany({
      where: {
        companyId,
        deletedAt: null,
        amount: abs,
        status: {
          notIn: [
            FinInstrumentStatus.REJECTED,
            FinInstrumentStatus.CANCELLED,
          ],
        },
        id: {
          notIn: matchedInstrumentIds.length
            ? matchedInstrumentIds
            : undefined,
        },
      },
      include: { payment: { select: { number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    return {
      line: serializeLine(line),
      payments: payments.map((p) => ({
        id: p.id,
        number: p.number,
        amount: p.amount.toFixed(3),
        method: p.method,
        paymentDate: p.paymentDate.toISOString().slice(0, 10),
        customerName: custMap.get(p.customerId) ?? null,
        reference: p.reference,
      })),
      instruments: instruments.map((i) => ({
        id: i.id,
        number: i.number,
        type: i.type,
        status: i.status,
        amount: i.amount.toFixed(3),
        paymentId: i.paymentId,
        paymentNumber: i.payment.number,
        bankName: i.bankName,
      })),
    };
  }

  private async createLineTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    bankAccountId: string,
    dto: CreateBankStatementLineDto,
  ) {
    if (!Number.isFinite(dto.amount) || dto.amount === 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_AMOUNT,
        'Statement line amount must be non-zero.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return tx.finBankStatementLine.create({
      data: {
        companyId,
        bankAccountId,
        lineDate: new Date(dto.lineDate),
        amount: new Prisma.Decimal(dto.amount),
        reference: dto.reference?.trim() || null,
        counterparty: dto.counterparty?.trim() || null,
        memo: dto.memo?.trim() || null,
      },
    });
  }

  private async requireAccount(companyId: string, id: string) {
    const row = await this.prisma.finBankAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_ACCOUNT_NOT_FOUND,
        'Bank account not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeAccount(
  row: {
    id: string;
    companyId: string;
    code: string;
    label: string;
    bankName: string | null;
    rib: string | null;
    iban: string | null;
    glAccountCode: string | null;
    currency: string;
    active: boolean;
    isDefault: boolean;
    notes: string | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  },
  unmatchedCount: number,
): BankAccountDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    label: row.label,
    bankName: row.bankName,
    rib: row.rib,
    iban: row.iban,
    glAccountCode: row.glAccountCode,
    currency: row.currency,
    active: row.active,
    isDefault: row.isDefault,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    unmatchedCount,
  };
}

function serializeLine(row: {
  id: string;
  companyId: string;
  bankAccountId: string;
  lineDate: Date;
  amount: Prisma.Decimal;
  currency: string;
  reference: string | null;
  counterparty: string | null;
  memo: string | null;
  status: FinBankLineStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  match:
    | ({
        id: string;
        paymentId: string | null;
        instrumentId: string | null;
        note: string | null;
        matchedAt: Date;
        payment: { number: string } | null;
        instrument: { number: string } | null;
      } | null)
    | null;
}): BankStatementLineDto {
  return {
    id: row.id,
    companyId: row.companyId,
    bankAccountId: row.bankAccountId,
    lineDate: row.lineDate.toISOString().slice(0, 10),
    amount: row.amount.toFixed(3),
    currency: row.currency,
    reference: row.reference,
    counterparty: row.counterparty,
    memo: row.memo,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    match: row.match
      ? {
          id: row.match.id,
          paymentId: row.match.paymentId,
          instrumentId: row.match.instrumentId,
          note: row.match.note,
          matchedAt: row.match.matchedAt.toISOString(),
          paymentNumber: row.match.payment?.number ?? null,
          instrumentNumber: row.match.instrument?.number ?? null,
        }
      : null,
  };
}

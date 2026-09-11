import { HttpStatus, Injectable } from '@nestjs/common';
import {
  FinBankLineStatus,
  FinInstrumentStatus,
  FinPaymentStatus,
  Prisma,
} from '@prisma/client';
import { AccountingGlMappingResolver } from '../accounting/accounting-gl-mapping.resolver';
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
  IgnoreBankLineDto,
  ImportBankCsvDto,
  ImportBankOfxDto,
  MatchBankLineDto,
  UpdateBankAccountDto,
} from './finance.dto';
import { FinanceException } from './finance.exception';
import { parseBankStatementCsv } from './bank-csv';
import { parseBankStatementOfx } from './bank-ofx';

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
  matchedCount: number;
  ignoredCount: number;
};

export type BankTreasuryDto = {
  currency: 'TND';
  accountCount: number;
  activeAccountCount: number;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
  accounts: {
    id: string;
    code: string;
    label: string;
    active: boolean;
    unmatchedCount: number;
    matchedCount: number;
    ignoredCount: number;
  }[];
};

export type BankCsvPreviewDto = {
  delimiter: ',' | ';';
  lineCount: number;
  errorCount: number;
  lines: {
    row: number;
    lineDate: string;
    amount: number;
    reference?: string;
    counterparty?: string;
    memo?: string;
  }[];
  errors: { row: number; message: string }[];
};

export type BankOfxPreviewDto = {
  dialect: 'OFX1';
  lineCount: number;
  errorCount: number;
  duplicateFitIdCount: number;
  lines: {
    row: number;
    lineDate: string;
    amount: number;
    fitId: string;
    reference?: string;
    counterparty?: string;
    memo?: string;
    duplicate?: boolean;
  }[];
  errors: { row: number; message: string }[];
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
  fitId: string | null;
  feePostedAt: string | null;
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
    private readonly glMapping: AccountingGlMappingResolver,
  ) {}

  async listAccounts(companyId: string): Promise<{ items: BankAccountDto[] }> {
    const rows = await this.prisma.finBankAccount.findMany({
      where: { companyId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
    const counts = await this.lineCountsByAccount(companyId);
    return {
      items: rows.map((r) =>
        serializeAccount(r, counts.get(r.id) ?? EMPTY_COUNTS),
      ),
    };
  }

  /** Soft treasury strip — line status counts only, no invented balances (D191). */
  async treasury(companyId: string): Promise<BankTreasuryDto> {
    const accounts = await this.listAccounts(companyId);
    let unmatchedCount = 0;
    let matchedCount = 0;
    let ignoredCount = 0;
    for (const a of accounts.items) {
      unmatchedCount += a.unmatchedCount;
      matchedCount += a.matchedCount;
      ignoredCount += a.ignoredCount;
    }
    return {
      currency: 'TND',
      accountCount: accounts.items.length,
      activeAccountCount: accounts.items.filter((a) => a.active).length,
      unmatchedCount,
      matchedCount,
      ignoredCount,
      accounts: accounts.items.map((a) => ({
        id: a.id,
        code: a.code,
        label: a.label,
        active: a.active,
        unmatchedCount: a.unmatchedCount,
        matchedCount: a.matchedCount,
        ignoredCount: a.ignoredCount,
      })),
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
    return serializeAccount(row, EMPTY_COUNTS);
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
    const counts = await this.lineCountsByAccount(companyId, id);
    return serializeAccount(row, counts.get(id) ?? EMPTY_COUNTS);
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

  async previewCsv(
    companyId: string,
    bankAccountId: string,
    dto: ImportBankCsvDto,
  ): Promise<BankCsvPreviewDto> {
    await this.requireAccount(companyId, bankAccountId);
    const parsed = parseBankStatementCsv(dto.csv ?? '');
    if (parsed.lines.length === 0 && parsed.errors.length > 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_CSV_INVALID,
        parsed.errors[0]!.message,
        HttpStatus.BAD_REQUEST,
        { errors: parsed.errors },
      );
    }
    return {
      delimiter: parsed.delimiter,
      lineCount: parsed.lines.length,
      errorCount: parsed.errors.length,
      lines: parsed.lines,
      errors: parsed.errors,
    };
  }

  async importCsv(
    companyId: string,
    bankAccountId: string,
    dto: ImportBankCsvDto,
  ): Promise<{ items: BankStatementLineDto[]; skippedErrors: number }> {
    await this.requireAccount(companyId, bankAccountId);
    const parsed = parseBankStatementCsv(dto.csv ?? '');
    if (parsed.lines.length === 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_CSV_INVALID,
        parsed.errors[0]?.message ?? 'No valid CSV lines to import.',
        HttpStatus.BAD_REQUEST,
        { errors: parsed.errors },
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const line of parsed.lines) {
        out.push(
          await this.createLineTx(tx, companyId, bankAccountId, {
            lineDate: line.lineDate,
            amount: line.amount,
            reference: line.reference,
            counterparty: line.counterparty,
            memo: line.memo,
          }),
        );
      }
      return out;
    });
    return {
      items: created.map((r) => serializeLine({ ...r, match: null })),
      skippedErrors: parsed.errors.length,
    };
  }

  async previewOfx(
    companyId: string,
    bankAccountId: string,
    dto: ImportBankOfxDto,
  ): Promise<BankOfxPreviewDto> {
    await this.requireAccount(companyId, bankAccountId);
    const parsed = parseBankStatementOfx(dto.ofx ?? '');
    if (parsed.lines.length === 0 && parsed.errors.length > 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_OFX_INVALID,
        parsed.errors[0]!.message,
        HttpStatus.BAD_REQUEST,
        { errors: parsed.errors },
      );
    }
    const existingFit = await this.existingFitIds(
      companyId,
      bankAccountId,
      parsed.lines.map((l) => l.fitId),
    );
    const lines = parsed.lines.map((l) => ({
      ...l,
      duplicate: existingFit.has(l.fitId),
    }));
    return {
      dialect: parsed.dialect,
      lineCount: lines.length,
      errorCount: parsed.errors.length,
      duplicateFitIdCount: lines.filter((l) => l.duplicate).length,
      lines,
      errors: parsed.errors,
    };
  }

  async importOfx(
    companyId: string,
    bankAccountId: string,
    dto: ImportBankOfxDto,
  ): Promise<{
    items: BankStatementLineDto[];
    skippedDuplicates: number;
    skippedErrors: number;
  }> {
    await this.requireAccount(companyId, bankAccountId);
    const parsed = parseBankStatementOfx(dto.ofx ?? '');
    if (parsed.lines.length === 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_OFX_INVALID,
        parsed.errors[0]?.message ?? 'No valid OFX transactions to import.',
        HttpStatus.BAD_REQUEST,
        { errors: parsed.errors },
      );
    }
    const existingFit = await this.existingFitIds(
      companyId,
      bankAccountId,
      parsed.lines.map((l) => l.fitId),
    );
    const toImport = parsed.lines.filter((l) => !existingFit.has(l.fitId));
    if (toImport.length === 0) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_OFX_INVALID,
        'All FITID already imported for this account.',
        HttpStatus.CONFLICT,
        { duplicateFitIdCount: parsed.lines.length },
      );
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const out = [];
      for (const line of toImport) {
        out.push(
          await this.createLineTx(tx, companyId, bankAccountId, {
            lineDate: line.lineDate,
            amount: line.amount,
            reference: line.reference,
            counterparty: line.counterparty,
            memo: line.memo,
            fitId: line.fitId,
          }),
        );
      }
      return out;
    });
    return {
      items: created.map((r) => serializeLine({ ...r, match: null })),
      skippedDuplicates: parsed.lines.length - toImport.length,
      skippedErrors: parsed.errors.length,
    };
  }

  /**
   * Explicit fee GL (D193) — ignore alone stays GL-free.
   * Debit lines only; requires Prefs accounting.gl.bank_fee.
   */
  async postFee(
    companyId: string,
    lineId: string,
  ): Promise<BankStatementLineDto> {
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
    if (line.status !== FinBankLineStatus.IGNORED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_FEE_NOT_ELIGIBLE,
        'Only ignored debit lines can post bank fees.',
        HttpStatus.CONFLICT,
      );
    }
    if (line.amount.gte(0)) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_FEE_NOT_ELIGIBLE,
        'Bank fee posting requires a debit (−) amount.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (line.feePostedAt) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_FEE_ALREADY_POSTED,
        'Bank fee already posted for this line.',
        HttpStatus.CONFLICT,
      );
    }
    const map = await this.glMapping.resolve(companyId);
    if (!map.bankFee.trim()) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_FEE_GL_MISSING,
        'Configure accounting.gl.bank_fee in Préférences / Comptabilité before posting fees.',
        HttpStatus.CONFLICT,
      );
    }
    const feeAmount = line.amount.abs();
    const entryDate = line.lineDate.toISOString().slice(0, 10);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.finBankStatementLine.update({
        where: { id: line.id },
        data: {
          feePostedAt: new Date(),
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
        eventType: FINANCE_EVENT_TYPES.BANK_FEE_POSTED,
        aggregateType: 'fin_bank_statement_line',
        aggregateId: line.id,
        payloadJson: {
          statementLineId: line.id,
          bankAccountId: line.bankAccountId,
          amount: Number(feeAmount.toFixed(3)),
          entryDate,
        },
      });
      return row;
    });
    return serializeLine(updated);
  }

  async ignoreLine(
    companyId: string,
    lineId: string,
    dto: IgnoreBankLineDto,
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
    if (line.status === FinBankLineStatus.MATCHED || line.match) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_ALREADY_MATCHED,
        'Unmatch before ignoring.',
        HttpStatus.CONFLICT,
      );
    }
    if (line.status === FinBankLineStatus.IGNORED) {
      return serializeLine({
        ...line,
        match: null,
      });
    }
    const memo =
      dto.memo?.trim() ||
      line.memo ||
      'Ignoré (frais / orphelin) — pas de GL';
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.finBankStatementLine.update({
        where: { id: line.id },
        data: {
          status: FinBankLineStatus.IGNORED,
          memo,
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
        eventType: FINANCE_EVENT_TYPES.BANK_IGNORED,
        aggregateType: 'fin_bank_statement_line',
        aggregateId: line.id,
        payloadJson: {
          statementLineId: line.id,
          bankAccountId: line.bankAccountId,
          memo,
        },
      });
      return row;
    });
    return serializeLine(updated);
  }

  async unignoreLine(
    companyId: string,
    lineId: string,
  ): Promise<BankStatementLineDto> {
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
    if (line.status !== FinBankLineStatus.IGNORED) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.INVALID_STATUS,
        'Line is not ignored.',
        HttpStatus.CONFLICT,
      );
    }
    if (line.feePostedAt) {
      throw new FinanceException(
        FINANCE_ERROR_CODES.BANK_FEE_ALREADY_POSTED,
        'Cannot re-open a line after bank fee GL was posted.',
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
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
        eventType: FINANCE_EVENT_TYPES.BANK_UNIGNORED,
        aggregateType: 'fin_bank_statement_line',
        aggregateId: line.id,
        payloadJson: {
          statementLineId: line.id,
          bankAccountId: line.bankAccountId,
        },
      });
      return row;
    });
    return serializeLine(updated);
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

  private async existingFitIds(
    companyId: string,
    bankAccountId: string,
    fitIds: string[],
  ): Promise<Set<string>> {
    const uniq = [...new Set(fitIds.filter(Boolean))];
    if (uniq.length === 0) return new Set();
    const rows = await this.prisma.finBankStatementLine.findMany({
      where: {
        companyId,
        bankAccountId,
        deletedAt: null,
        fitId: { in: uniq },
      },
      select: { fitId: true },
    });
    return new Set(rows.map((r) => r.fitId!).filter(Boolean));
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
    const fitId = dto.fitId?.trim() || null;
    if (fitId) {
      const dup = await tx.finBankStatementLine.findFirst({
        where: {
          companyId,
          bankAccountId,
          fitId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (dup) {
        throw new FinanceException(
          FINANCE_ERROR_CODES.BANK_OFX_INVALID,
          `FITID already imported: ${fitId}`,
          HttpStatus.CONFLICT,
        );
      }
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
        fitId,
      },
    });
  }

  private async lineCountsByAccount(
    companyId: string,
    bankAccountId?: string,
  ): Promise<
    Map<
      string,
      { unmatchedCount: number; matchedCount: number; ignoredCount: number }
    >
  > {
    const grouped = await this.prisma.finBankStatementLine.groupBy({
      by: ['bankAccountId', 'status'],
      where: {
        companyId,
        deletedAt: null,
        ...(bankAccountId ? { bankAccountId } : {}),
      },
      _count: { _all: true },
    });
    const map = new Map<
      string,
      { unmatchedCount: number; matchedCount: number; ignoredCount: number }
    >();
    for (const g of grouped) {
      const cur = map.get(g.bankAccountId) ?? { ...EMPTY_COUNTS };
      if (g.status === FinBankLineStatus.UNMATCHED) {
        cur.unmatchedCount = g._count._all;
      } else if (g.status === FinBankLineStatus.MATCHED) {
        cur.matchedCount = g._count._all;
      } else if (g.status === FinBankLineStatus.IGNORED) {
        cur.ignoredCount = g._count._all;
      }
      map.set(g.bankAccountId, cur);
    }
    return map;
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

const EMPTY_COUNTS = {
  unmatchedCount: 0,
  matchedCount: 0,
  ignoredCount: 0,
};

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
  counts: {
    unmatchedCount: number;
    matchedCount: number;
    ignoredCount: number;
  },
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
    unmatchedCount: counts.unmatchedCount,
    matchedCount: counts.matchedCount,
    ignoredCount: counts.ignoredCount,
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
  fitId: string | null;
  feePostedAt: Date | null;
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
    fitId: row.fitId,
    feePostedAt: row.feePostedAt?.toISOString() ?? null,
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

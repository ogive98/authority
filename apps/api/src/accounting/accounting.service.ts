import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AccAccount,
  AccAccountType,
  AccEntryStatus,
  AccFiscalPeriod,
  AccFiscalYear,
  AccJournal,
  AccJournalEntry,
  AccJournalLine,
  AccPeriodStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACCOUNTING_ERROR_CODES,
  ACCOUNTING_EVENT_TYPES,
} from './accounting.constants';
import type {
  CreateAccountDto,
  CreateFiscalPeriodDto,
  CreateFiscalYearDto,
  CreateJournalDto,
  CreateJournalEntryDto,
  UpdatePeriodStatusDto,
} from './accounting.dto';
import { AccountingException } from './accounting.exception';

export type AccountDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccAccountType;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type JournalDto = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FiscalPeriodDto = {
  id: string;
  companyId: string;
  fiscalYearId: string;
  code: string;
  startDate: string;
  endDate: string;
  status: AccPeriodStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FiscalYearDto = {
  id: string;
  companyId: string;
  code: string;
  startDate: string;
  endDate: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  periods: FiscalPeriodDto[];
};

export type JournalLineDtoOut = {
  id: string;
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  debit: string;
  credit: string;
  memo: string | null;
  lineNo: number;
};

export type JournalEntryDto = {
  id: string;
  companyId: string;
  journalId: string;
  journalCode: string | null;
  periodId: string;
  periodCode: string | null;
  number: string;
  status: AccEntryStatus;
  entryDate: string;
  description: string | null;
  sourceType: string | null;
  sourceId: string | null;
  postedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: JournalLineDtoOut[];
};

export type TrialBalanceRowDto = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccAccountType;
  debit: string;
  credit: string;
  balance: string;
};

@Injectable()
export class AccountingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  // ─── Chart of accounts ───────────────────────────────────────────────────

  async listAccounts(
    companyId: string,
    opts?: { q?: string; type?: string; active?: boolean; limit?: number; cursor?: string },
  ): Promise<{ items: AccountDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();
    const type = opts?.type?.trim().toUpperCase();

    const where: Prisma.AccAccountWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.active !== undefined ? { active: opts.active } : {}),
      ...(type && Object.values(AccAccountType).includes(type as AccAccountType)
        ? { type: type as AccAccountType }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.accAccount.findMany({
      where,
      orderBy: [{ code: 'asc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page.map(serializeAccount), nextCursor };
  }

  async createAccount(
    companyId: string,
    dto: CreateAccountDto,
  ): Promise<AccountDto> {
    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code || !name) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.INVALID_LINE,
        'code and name are required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const account = await tx.accAccount.create({
          data: {
            companyId,
            code,
            name,
            type: dto.type,
            active: dto.active ?? true,
          },
        });

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'acc_account',
          aggregateId: account.id,
          eventType: ACCOUNTING_EVENT_TYPES.ACCOUNT_CREATED,
          payloadJson: {
            accountId: account.id,
            code: account.code,
            type: account.type,
          },
        });

        return account;
      });
      return serializeAccount(row);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        ACCOUNTING_ERROR_CODES.DUPLICATE_CODE,
        'Account code already exists for this company.',
      );
      throw error;
    }
  }

  // ─── Journals ────────────────────────────────────────────────────────────

  async listJournals(
    companyId: string,
    opts?: { q?: string; limit?: number; cursor?: string },
  ): Promise<{ items: JournalDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const q = opts?.q?.trim();

    const where: Prisma.AccJournalWhereInput = {
      companyId,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.accJournal.findMany({
      where,
      orderBy: [{ code: 'asc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page.map(serializeJournal), nextCursor };
  }

  async createJournal(
    companyId: string,
    dto: CreateJournalDto,
  ): Promise<JournalDto> {
    const code = dto.code.trim();
    const name = dto.name.trim();
    try {
      const row = await this.prisma.accJournal.create({
        data: {
          companyId,
          code,
          name,
          active: dto.active ?? true,
        },
      });
      return serializeJournal(row);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        ACCOUNTING_ERROR_CODES.DUPLICATE_CODE,
        'Journal code already exists for this company.',
      );
      throw error;
    }
  }

  // ─── Fiscal year / periods ───────────────────────────────────────────────

  async listFiscalYears(
    companyId: string,
  ): Promise<{ items: FiscalYearDto[] }> {
    const rows = await this.prisma.accFiscalYear.findMany({
      where: { companyId, deletedAt: null },
      include: {
        periods: {
          where: { deletedAt: null },
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: { startDate: 'desc' },
    });
    return { items: rows.map(serializeFiscalYear) };
  }

  async createFiscalYear(
    companyId: string,
    dto: CreateFiscalYearDto,
  ): Promise<FiscalYearDto> {
    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.INVALID_LINE,
        'endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const year = await tx.accFiscalYear.create({
          data: {
            companyId,
            code: dto.code.trim(),
            startDate,
            endDate,
          },
        });

        if (dto.createMonthlyPeriods) {
          const periods = buildMonthlyPeriods(startDate, endDate);
          for (const p of periods) {
            await tx.accFiscalPeriod.create({
              data: {
                companyId,
                fiscalYearId: year.id,
                code: p.code,
                startDate: p.startDate,
                endDate: p.endDate,
                status: AccPeriodStatus.OPEN,
              },
            });
          }
        }

        return tx.accFiscalYear.findFirstOrThrow({
          where: { id: year.id },
          include: {
            periods: {
              where: { deletedAt: null },
              orderBy: { startDate: 'asc' },
            },
          },
        });
      });
      return serializeFiscalYear(row);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        ACCOUNTING_ERROR_CODES.DUPLICATE_CODE,
        'Fiscal year or period code already exists for this company.',
      );
      throw error;
    }
  }

  async createFiscalPeriod(
    companyId: string,
    fiscalYearId: string,
    dto: CreateFiscalPeriodDto,
  ): Promise<FiscalPeriodDto> {
    const year = await this.prisma.accFiscalYear.findFirst({
      where: { id: fiscalYearId, companyId, deletedAt: null },
    });
    if (!year) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.YEAR_NOT_FOUND,
        'Fiscal year not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const startDate = parseDateOnly(dto.startDate);
    const endDate = parseDateOnly(dto.endDate);
    if (endDate < startDate) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.INVALID_LINE,
        'endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const row = await this.prisma.accFiscalPeriod.create({
        data: {
          companyId,
          fiscalYearId,
          code: dto.code.trim(),
          startDate,
          endDate,
          status: dto.status ?? AccPeriodStatus.OPEN,
        },
      });
      return serializePeriod(row);
    } catch (error) {
      throwIfUniqueViolation(
        error,
        ACCOUNTING_ERROR_CODES.DUPLICATE_CODE,
        'Period code already exists for this company.',
      );
      throw error;
    }
  }

  async listPeriods(
    companyId: string,
    opts?: { fiscalYearId?: string; status?: string },
  ): Promise<{ items: FiscalPeriodDto[] }> {
    const status = opts?.status?.trim().toUpperCase();
    const rows = await this.prisma.accFiscalPeriod.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(opts?.fiscalYearId ? { fiscalYearId: opts.fiscalYearId } : {}),
        ...(status &&
        Object.values(AccPeriodStatus).includes(status as AccPeriodStatus)
          ? { status: status as AccPeriodStatus }
          : {}),
      },
      orderBy: { startDate: 'asc' },
    });
    return { items: rows.map(serializePeriod) };
  }

  async updatePeriodStatus(
    companyId: string,
    periodId: string,
    dto: UpdatePeriodStatusDto,
  ): Promise<FiscalPeriodDto> {
    const existing = await this.prisma.accFiscalPeriod.findFirst({
      where: { id: periodId, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.PERIOD_NOT_FOUND,
        'Fiscal period not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status === AccPeriodStatus.LOCKED) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.IMMUTABLE,
        'LOCKED periods cannot change status.',
        HttpStatus.CONFLICT,
      );
    }

    const row = await this.prisma.accFiscalPeriod.update({
      where: { id: periodId },
      data: { status: dto.status, version: { increment: 1 } },
    });
    return serializePeriod(row);
  }

  // ─── Journal entries ─────────────────────────────────────────────────────

  async listEntries(
    companyId: string,
    opts?: {
      journalId?: string;
      periodId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ items: JournalEntryDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
    const status = opts?.status?.trim().toUpperCase();

    const where: Prisma.AccJournalEntryWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts?.journalId ? { journalId: opts.journalId } : {}),
      ...(opts?.periodId ? { periodId: opts.periodId } : {}),
      ...(status &&
      Object.values(AccEntryStatus).includes(status as AccEntryStatus)
        ? { status: status as AccEntryStatus }
        : {}),
      ...(opts?.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.accJournalEntry.findMany({
      where,
      include: {
        lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
        journal: true,
        period: true,
      },
      orderBy: [{ entryDate: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page.map(serializeEntry), nextCursor };
  }

  async getEntry(companyId: string, id: string): Promise<JournalEntryDto> {
    const row = await this.findEntry(companyId, id);
    return serializeEntry(row);
  }

  async createEntry(
    companyId: string,
    dto: CreateJournalEntryDto,
  ): Promise<JournalEntryDto> {
    this.assertBalancedLines(dto.lines);

    const journal = await this.prisma.accJournal.findFirst({
      where: { id: dto.journalId, companyId, deletedAt: null },
    });
    if (!journal) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.JOURNAL_NOT_FOUND,
        'Journal not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!journal.active) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.INVALID_STATUS,
        'Journal is inactive.',
        HttpStatus.CONFLICT,
      );
    }

    const period = await this.prisma.accFiscalPeriod.findFirst({
      where: { id: dto.periodId, companyId, deletedAt: null },
    });
    if (!period) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.PERIOD_NOT_FOUND,
        'Fiscal period not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.accAccount.findMany({
      where: {
        companyId,
        id: { in: accountIds },
        deletedAt: null,
      },
    });
    if (accounts.length !== accountIds.length) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.ACCOUNT_NOT_FOUND,
        'One or more accounts not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const inactive = accounts.find((a) => !a.active);
    if (inactive) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.ACCOUNT_INACTIVE,
        `Account ${inactive.code} is inactive.`,
        HttpStatus.CONFLICT,
      );
    }

    const number = await this.nextEntryNumber(companyId);
    const entryDate = parseDateOnly(dto.entryDate);

    const row = await this.prisma.accJournalEntry.create({
      data: {
        companyId,
        journalId: dto.journalId,
        periodId: dto.periodId,
        number,
        status: AccEntryStatus.DRAFT,
        entryDate,
        description: dto.description?.trim() || null,
        sourceType: dto.sourceType?.trim() || null,
        sourceId: dto.sourceId ?? null,
        lines: {
          create: dto.lines.map((line) => ({
            companyId,
            accountId: line.accountId,
            debit: round3(line.debit),
            credit: round3(line.credit),
            memo: line.memo?.trim() || null,
            lineNo: line.lineNo,
          })),
        },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
        journal: true,
        period: true,
      },
    });

    return serializeEntry(row);
  }

  /**
   * Post a DRAFT entry. V0: period must be OPEN only
   * (SOFT_CLOSED / CLOSED / LOCKED refuse posting).
   */
  async postEntry(companyId: string, id: string): Promise<JournalEntryDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.accJournalEntry.findFirst({
        where: { id, companyId, deletedAt: null },
        include: {
          lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
          journal: true,
          period: true,
        },
      });
      if (!existing) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.ENTRY_NOT_FOUND,
          'Journal entry not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status !== AccEntryStatus.DRAFT) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_STATUS,
          'Only DRAFT entries can be posted.',
          HttpStatus.CONFLICT,
        );
      }

      if (existing.period.status !== AccPeriodStatus.OPEN) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.PERIOD_CLOSED,
          `Cannot post: period status is ${existing.period.status} (OPEN required).`,
          HttpStatus.CONFLICT,
        );
      }

      this.assertBalancedLines(
        existing.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
          lineNo: l.lineNo,
        })),
      );

      const locked = await tx.accJournalEntry.updateMany({
        where: {
          id,
          companyId,
          deletedAt: null,
          status: AccEntryStatus.DRAFT,
          version: existing.version,
        },
        data: {
          status: AccEntryStatus.POSTED,
          postedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (locked.count !== 1) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_STATUS,
          'Post conflict — retry.',
          HttpStatus.CONFLICT,
        );
      }

      const updated = await tx.accJournalEntry.findFirstOrThrow({
        where: { id, companyId },
        include: {
          lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
          journal: true,
          period: true,
        },
      });

      const debitTotal = updated.lines.reduce(
        (s, l) => s + Number(l.debit),
        0,
      );

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'acc_journal_entry',
        aggregateId: id,
        eventType: ACCOUNTING_EVENT_TYPES.ENTRY_POSTED,
        payloadJson: {
          entryId: id,
          number: updated.number,
          periodId: updated.periodId,
          journalId: updated.journalId,
          debitTotal: round3(debitTotal).toFixed(3),
        },
      });

      return updated;
    });

    return serializeEntry(row);
  }

  /**
   * Reverse a POSTED entry by creating a new reversing DRAFT→POSTED pair
   * (new entry with swapped debit/credit). Original becomes REVERSED.
   */
  async reverseEntry(
    companyId: string,
    id: string,
  ): Promise<JournalEntryDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.accJournalEntry.findFirst({
        where: { id, companyId, deletedAt: null },
        include: {
          lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
          journal: true,
          period: true,
        },
      });
      if (!existing) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.ENTRY_NOT_FOUND,
          'Journal entry not found.',
          HttpStatus.NOT_FOUND,
        );
      }
      if (existing.status !== AccEntryStatus.POSTED) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_STATUS,
          'Only POSTED entries can be reversed.',
          HttpStatus.CONFLICT,
        );
      }
      if (existing.period.status !== AccPeriodStatus.OPEN) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.PERIOD_CLOSED,
          `Cannot reverse: period status is ${existing.period.status} (OPEN required).`,
          HttpStatus.CONFLICT,
        );
      }

      const number = await this.nextEntryNumber(companyId, tx);
      const reversing = await tx.accJournalEntry.create({
        data: {
          companyId,
          journalId: existing.journalId,
          periodId: existing.periodId,
          number,
          status: AccEntryStatus.POSTED,
          entryDate: existing.entryDate,
          description:
            existing.description != null
              ? `Reversal of ${existing.number}: ${existing.description}`
              : `Reversal of ${existing.number}`,
          sourceType: 'REVERSAL',
          sourceId: existing.id,
          postedAt: new Date(),
          lines: {
            create: existing.lines.map((line) => ({
              companyId,
              accountId: line.accountId,
              debit: line.credit,
              credit: line.debit,
              memo: line.memo
                ? `Reversal: ${line.memo}`
                : `Reversal of ${existing.number}`,
              lineNo: line.lineNo,
            })),
          },
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
          journal: true,
          period: true,
        },
      });

      await tx.accJournalEntry.update({
        where: { id: existing.id },
        data: {
          status: AccEntryStatus.REVERSED,
          version: { increment: 1 },
        },
      });

      const debitTotal = reversing.lines.reduce(
        (s, l) => s + Number(l.debit),
        0,
      );

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'acc_journal_entry',
        aggregateId: reversing.id,
        eventType: ACCOUNTING_EVENT_TYPES.ENTRY_POSTED,
        payloadJson: {
          entryId: reversing.id,
          number: reversing.number,
          periodId: reversing.periodId,
          journalId: reversing.journalId,
          debitTotal: round3(debitTotal).toFixed(3),
          reversesEntryId: existing.id,
        },
      });

      return reversing;
    });

    return serializeEntry(row);
  }

  // ─── Trial balance V0 ────────────────────────────────────────────────────

  async trialBalance(
    companyId: string,
    opts?: { periodId?: string },
  ): Promise<{ items: TrialBalanceRowDto[]; periodId: string | null }> {
    if (opts?.periodId) {
      const period = await this.prisma.accFiscalPeriod.findFirst({
        where: { id: opts.periodId, companyId, deletedAt: null },
      });
      if (!period) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.PERIOD_NOT_FOUND,
          'Fiscal period not found.',
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const lines = await this.prisma.accJournalLine.findMany({
      where: {
        companyId,
        entry: {
          companyId,
          deletedAt: null,
          status: AccEntryStatus.POSTED,
          ...(opts?.periodId ? { periodId: opts.periodId } : {}),
        },
      },
      include: { account: true },
    });

    const byAccount = new Map<
      string,
      { account: AccAccount; debit: number; credit: number }
    >();

    for (const line of lines) {
      if (line.account.deletedAt) continue;
      const cur = byAccount.get(line.accountId) ?? {
        account: line.account,
        debit: 0,
        credit: 0,
      };
      cur.debit = round3(cur.debit + Number(line.debit));
      cur.credit = round3(cur.credit + Number(line.credit));
      byAccount.set(line.accountId, cur);
    }

    const items = [...byAccount.values()]
      .sort((a, b) => a.account.code.localeCompare(b.account.code))
      .map(({ account, debit, credit }) => ({
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.type,
        debit: debit.toFixed(3),
        credit: credit.toFixed(3),
        balance: round3(debit - credit).toFixed(3),
      }));

    return { items, periodId: opts?.periodId ?? null };
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private assertBalancedLines(
    lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      lineNo: number;
      memo?: string | null;
    }>,
  ): void {
    if (lines.length < 2) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.INVALID_LINE,
        'At least two journal lines are required.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const lineNos = new Set<number>();
    let debitSum = 0;
    let creditSum = 0;

    for (const line of lines) {
      if (lineNos.has(line.lineNo)) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_LINE,
          `Duplicate lineNo ${line.lineNo}.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      lineNos.add(line.lineNo);

      const debit = round3(line.debit);
      const credit = round3(line.credit);
      if (debit < 0 || credit < 0) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_LINE,
          'Debit and credit must be non-negative.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (debit > 0 && credit > 0) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_LINE,
          'A line cannot have both debit and credit.',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (debit === 0 && credit === 0) {
        throw new AccountingException(
          ACCOUNTING_ERROR_CODES.INVALID_LINE,
          'A line must have a non-zero debit or credit.',
          HttpStatus.BAD_REQUEST,
        );
      }
      debitSum = round3(debitSum + debit);
      creditSum = round3(creditSum + credit);
    }

    if (Math.abs(debitSum - creditSum) > 1e-9) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.UNBALANCED,
        `Debit sum (${debitSum.toFixed(3)}) must equal credit sum (${creditSum.toFixed(3)}).`,
        HttpStatus.BAD_REQUEST,
        { debitSum, creditSum },
      );
    }
  }

  private async findEntry(
    companyId: string,
    id: string,
  ): Promise<
    AccJournalEntry & {
      lines: (AccJournalLine & { account: AccAccount })[];
      journal: AccJournal;
      period: AccFiscalPeriod;
    }
  > {
    const row = await this.prisma.accJournalEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        lines: { orderBy: { lineNo: 'asc' }, include: { account: true } },
        journal: true,
        period: true,
      },
    });
    if (!row) {
      throw new AccountingException(
        ACCOUNTING_ERROR_CODES.ENTRY_NOT_FOUND,
        'Journal entry not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextEntryNumber(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    const count = await db.accJournalEntry.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function parseDateOnly(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
}

function buildMonthlyPeriods(
  startDate: Date,
  endDate: Date,
): Array<{ code: string; startDate: Date; endDate: Date }> {
  const periods: Array<{ code: string; startDate: Date; endDate: Date }> = [];
  let cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  );
  const end = endDate.getTime();

  while (cursor.getTime() <= end) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth();
    const monthStart = new Date(Date.UTC(y, m, 1));
    const monthEnd = new Date(Date.UTC(y, m + 1, 0));
    const periodStart =
      monthStart < startDate ? startDate : monthStart;
    const periodEnd = monthEnd > endDate ? endDate : monthEnd;
    if (periodStart.getTime() <= periodEnd.getTime()) {
      periods.push({
        code: `${y}-${String(m + 1).padStart(2, '0')}`,
        startDate: periodStart,
        endDate: periodEnd,
      });
    }
    cursor = new Date(Date.UTC(y, m + 1, 1));
  }
  return periods;
}

function throwIfUniqueViolation(
  error: unknown,
  code: (typeof ACCOUNTING_ERROR_CODES)[keyof typeof ACCOUNTING_ERROR_CODES],
  message: string,
): void {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AccountingException(code, message, HttpStatus.CONFLICT);
  }
}

function serializeAccount(row: AccAccount): AccountDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    type: row.type,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeJournal(row: AccJournal): JournalDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePeriod(row: AccFiscalPeriod): FiscalPeriodDto {
  return {
    id: row.id,
    companyId: row.companyId,
    fiscalYearId: row.fiscalYearId,
    code: row.code,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeFiscalYear(
  row: AccFiscalYear & { periods: AccFiscalPeriod[] },
): FiscalYearDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    startDate: row.startDate.toISOString().slice(0, 10),
    endDate: row.endDate.toISOString().slice(0, 10),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    periods: row.periods.map(serializePeriod),
  };
}

function serializeEntry(
  row: AccJournalEntry & {
    lines: (AccJournalLine & { account: AccAccount })[];
    journal: AccJournal;
    period: AccFiscalPeriod;
  },
): JournalEntryDto {
  return {
    id: row.id,
    companyId: row.companyId,
    journalId: row.journalId,
    journalCode: row.journal?.code ?? null,
    periodId: row.periodId,
    periodCode: row.period?.code ?? null,
    number: row.number,
    status: row.status,
    entryDate: row.entryDate.toISOString().slice(0, 10),
    description: row.description,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    postedAt: row.postedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      accountCode: l.account?.code ?? null,
      accountName: l.account?.name ?? null,
      debit: Number(l.debit).toFixed(3),
      credit: Number(l.credit).toFixed(3),
      memo: l.memo,
      lineNo: l.lineNo,
    })),
  };
}

import { Injectable, Logger } from '@nestjs/common';
import { AccEntryStatus, AccPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from './accounting.service';
import { DEFAULT_GL_CODES } from './accounting.constants';

export type FinanceGlPostResult =
  | { outcome: 'posted'; entryId: string; number: string }
  | { outcome: 'existing'; entryId: string; number: string }
  | { outcome: 'skipped'; reason: string };

/**
 * Deterministic Finance → GL posting (amounts as-recorded, no tax invention).
 * Idempotent on sourceType + sourceId.
 */
@Injectable()
export class FinanceGlPostingService {
  private readonly logger = new Logger(FinanceGlPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  /** Invoice issued → Dr Clients (411) / Cr Ventes (701). */
  async postInvoiceIssued(
    companyId: string,
    input: {
      sourceId: string;
      invoiceId: string;
      amount: number;
      entryDate: string;
      description?: string;
    },
  ): Promise<FinanceGlPostResult> {
    const amount = round3(input.amount);
    if (amount <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_invoice',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const accounts = await this.resolveAccounts(companyId, [
      DEFAULT_GL_CODES.ar,
      DEFAULT_GL_CODES.revenue,
    ]);
    if (!accounts) {
      return { outcome: 'skipped', reason: 'missing CoA 411/701' };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_invoice',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description:
        input.description ?? `invoice:${input.invoiceId}`,
      journalCode: DEFAULT_GL_CODES.salesJournal,
      lines: [
        {
          accountId: accounts[DEFAULT_GL_CODES.ar]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'AR',
        },
        {
          accountId: accounts[DEFAULT_GL_CODES.revenue]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'Revenue',
        },
      ],
    });
  }

  /** Payment allocated → Dr Banque (512) / Cr Clients (411). */
  async postPaymentAllocated(
    companyId: string,
    input: {
      sourceId: string;
      paymentId: string;
      amount: number;
      entryDate: string;
    },
  ): Promise<FinanceGlPostResult> {
    const amount = round3(input.amount);
    if (amount <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_payment_alloc',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const accounts = await this.resolveAccounts(companyId, [
      DEFAULT_GL_CODES.bank,
      DEFAULT_GL_CODES.ar,
    ]);
    if (!accounts) {
      return { outcome: 'skipped', reason: 'missing CoA 512/411' };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_payment_alloc',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description: `payment:${input.paymentId}`,
      journalCode: DEFAULT_GL_CODES.bankJournal,
      lines: [
        {
          accountId: accounts[DEFAULT_GL_CODES.bank]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'Bank',
        },
        {
          accountId: accounts[DEFAULT_GL_CODES.ar]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'AR settle',
        },
      ],
    });
  }

  /** Instrument reject → reverse posted payment allocation entries for that payment. */
  async reversePaymentOnInstrumentReject(
    companyId: string,
    input: { paymentId: string; rejectSourceId: string },
  ): Promise<FinanceGlPostResult> {
    const already = await this.findBySource(
      companyId,
      'fin_instrument_reject',
      input.rejectSourceId,
    );
    if (already) {
      return {
        outcome: 'existing',
        entryId: already.id,
        number: already.number,
      };
    }

    const marker = `payment:${input.paymentId}`;
    const targets = await this.prisma.accJournalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: AccEntryStatus.POSTED,
        sourceType: 'fin_payment_alloc',
        description: marker,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (targets.length === 0) {
      return { outcome: 'skipped', reason: 'no posted payment GL to reverse' };
    }

    let last = targets[0]!;
    for (const entry of targets) {
      try {
        last = await this.accounting.reverseEntry(companyId, entry.id);
      } catch (error) {
        this.logger.warn(
          `GL reverse failed for ${entry.number}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return { outcome: 'skipped', reason: 'reverse failed' };
      }
    }

    await this.prisma.accJournalEntry.update({
      where: { id: last.id },
      data: {
        sourceType: 'fin_instrument_reject',
        sourceId: input.rejectSourceId,
      },
    });

    return {
      outcome: 'posted',
      entryId: last.id,
      number: last.number,
    };
  }

  private async findBySource(
    companyId: string,
    sourceType: string,
    sourceId: string,
  ) {
    return this.prisma.accJournalEntry.findFirst({
      where: {
        companyId,
        sourceType,
        sourceId,
        deletedAt: null,
        status: { in: [AccEntryStatus.POSTED, AccEntryStatus.DRAFT] },
      },
    });
  }

  private async resolveAccounts(
    companyId: string,
    codes: string[],
  ): Promise<Record<string, string> | null> {
    const rows = await this.prisma.accAccount.findMany({
      where: {
        companyId,
        code: { in: codes },
        deletedAt: null,
        active: true,
      },
    });
    if (rows.length !== codes.length) return null;
    const map: Record<string, string> = {};
    for (const row of rows) map[row.code] = row.id;
    return map;
  }

  private async resolveJournalId(
    companyId: string,
    code: string,
  ): Promise<string | null> {
    const preferred = await this.prisma.accJournal.findFirst({
      where: { companyId, code, deletedAt: null, active: true },
    });
    if (preferred) return preferred.id;
    const any = await this.prisma.accJournal.findFirst({
      where: { companyId, deletedAt: null, active: true },
      orderBy: { code: 'asc' },
    });
    return any?.id ?? null;
  }

  private async resolveOpenPeriodId(
    companyId: string,
    entryDate: string,
  ): Promise<string | null> {
    const d = new Date(`${entryDate}T00:00:00.000Z`);
    const covering = await this.prisma.accFiscalPeriod.findFirst({
      where: {
        companyId,
        deletedAt: null,
        status: AccPeriodStatus.OPEN,
        startDate: { lte: d },
        endDate: { gte: d },
      },
    });
    if (covering) return covering.id;
    const open = await this.prisma.accFiscalPeriod.findFirst({
      where: {
        companyId,
        deletedAt: null,
        status: AccPeriodStatus.OPEN,
      },
      orderBy: { startDate: 'desc' },
    });
    return open?.id ?? null;
  }

  private async createAndPost(
    companyId: string,
    input: {
      sourceType: string;
      sourceId: string;
      entryDate: string;
      description: string;
      journalCode: string;
      lines: {
        accountId: string;
        debit: number;
        credit: number;
        lineNo: number;
        memo?: string;
      }[];
    },
  ): Promise<FinanceGlPostResult> {
    const journalId = await this.resolveJournalId(companyId, input.journalCode);
    if (!journalId) {
      return { outcome: 'skipped', reason: 'no active journal' };
    }
    const periodId = await this.resolveOpenPeriodId(
      companyId,
      input.entryDate,
    );
    if (!periodId) {
      return { outcome: 'skipped', reason: 'no OPEN fiscal period' };
    }

    try {
      const draft = await this.accounting.createEntry(companyId, {
        journalId,
        periodId,
        entryDate: input.entryDate,
        description: input.description,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        lines: input.lines,
      });
      const posted = await this.accounting.postEntry(companyId, draft.id);
      return {
        outcome: 'posted',
        entryId: posted.id,
        number: posted.number,
      };
    } catch (error) {
      const again = await this.findBySource(
        companyId,
        input.sourceType,
        input.sourceId,
      );
      if (again) {
        return {
          outcome: 'existing',
          entryId: again.id,
          number: again.number,
        };
      }
      this.logger.warn(
        `GL post skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return {
        outcome: 'skipped',
        reason: error instanceof Error ? error.message : 'post failed',
      };
    }
  }
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

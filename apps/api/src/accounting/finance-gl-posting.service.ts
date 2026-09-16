import { Injectable, Logger } from '@nestjs/common';
import { AccEntryStatus, AccPeriodStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from './accounting.service';
import { AccountingGlMappingResolver } from './accounting-gl-mapping.resolver';

export type FinanceGlPostResult =
  | { outcome: 'posted'; entryId: string; number: string }
  | { outcome: 'existing'; entryId: string; number: string }
  | { outcome: 'skipped'; reason: string };

/**
 * Deterministic Finance → GL posting (amounts as-recorded, no tax invention).
 * Idempotent on sourceType + sourceId. CoA codes from company prefs (D179).
 */
@Injectable()
export class FinanceGlPostingService {
  private readonly logger = new Logger(FinanceGlPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly glMapping: AccountingGlMappingResolver,
  ) {}

  /** Invoice issued → Dr Clients TTC / Cr Ventes HT [/ Cr TVA as-recorded]. */
  async postInvoiceIssued(
    companyId: string,
    input: {
      sourceId: string;
      invoiceId: string;
      /** TTC — always required for AR. */
      amount: number;
      amountHt?: number;
      amountTax?: number;
      entryDate: string;
      description?: string;
    },
  ): Promise<FinanceGlPostResult> {
    const amountTtc = round3(input.amount);
    if (amountTtc <= 0) {
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

    const map = await this.glMapping.resolve(companyId);
    const tax = round3(input.amountTax ?? 0);
    const ht =
      input.amountHt != null
        ? round3(input.amountHt)
        : round3(amountTtc - tax);

    const useVatSplit =
      tax > 0 &&
      Math.abs(round3(ht + tax) - amountTtc) < 0.002;

    if (useVatSplit) {
      const accounts = await this.resolveAccounts(companyId, [
        map.ar,
        map.revenue,
        map.vat,
      ]);
      if (!accounts) {
        return {
          outcome: 'skipped',
          reason: `missing CoA ${map.ar}/${map.revenue}/${map.vat}`,
        };
      }
      return this.createAndPost(companyId, {
        sourceType: 'fin_invoice',
        sourceId: input.sourceId,
        entryDate: input.entryDate,
        description:
          input.description ?? `invoice:${input.invoiceId}`,
        journalCode: map.salesJournal,
        lines: [
          {
            accountId: accounts[map.ar]!,
            debit: amountTtc,
            credit: 0,
            lineNo: 1,
            memo: 'AR TTC',
          },
          {
            accountId: accounts[map.revenue]!,
            debit: 0,
            credit: ht,
            lineNo: 2,
            memo: 'Revenue HT',
          },
          {
            accountId: accounts[map.vat]!,
            debit: 0,
            credit: tax,
            lineNo: 3,
            memo: 'VAT as-recorded',
          },
        ],
      });
    }

    const accounts = await this.resolveAccounts(companyId, [
      map.ar,
      map.revenue,
    ]);
    if (!accounts) {
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.ar}/${map.revenue}`,
      };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_invoice',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description:
        input.description ?? `invoice:${input.invoiceId}`,
      journalCode: map.salesJournal,
      lines: [
        {
          accountId: accounts[map.ar]!,
          debit: amountTtc,
          credit: 0,
          lineNo: 1,
          memo: 'AR',
        },
        {
          accountId: accounts[map.revenue]!,
          debit: 0,
          credit: amountTtc,
          lineNo: 2,
          memo: 'Revenue',
        },
      ],
    });
  }

  /** Credit note issued → Cr Clients TTC / Dr Ventes HT [/ Dr TVA] (inverse of invoice). */
  async postCreditNoteIssued(
    companyId: string,
    input: {
      sourceId: string;
      creditNoteId: string;
      /** TTC — always required for AR credit. */
      amount: number;
      amountHt?: number;
      amountTax?: number;
      entryDate: string;
      description?: string;
    },
  ): Promise<FinanceGlPostResult> {
    const amountTtc = round3(input.amount);
    if (amountTtc <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_credit_note',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const map = await this.glMapping.resolve(companyId);
    const tax = round3(input.amountTax ?? 0);
    const ht =
      input.amountHt != null
        ? round3(input.amountHt)
        : round3(amountTtc - tax);

    const useVatSplit =
      tax > 0 && Math.abs(round3(ht + tax) - amountTtc) < 0.002;

    if (useVatSplit) {
      const accounts = await this.resolveAccounts(companyId, [
        map.ar,
        map.revenue,
        map.vat,
      ]);
      if (!accounts) {
        return {
          outcome: 'skipped',
          reason: `missing CoA ${map.ar}/${map.revenue}/${map.vat}`,
        };
      }
      return this.createAndPost(companyId, {
        sourceType: 'fin_credit_note',
        sourceId: input.sourceId,
        entryDate: input.entryDate,
        description:
          input.description ?? `credit_note:${input.creditNoteId}`,
        journalCode: map.salesJournal,
        lines: [
          {
            accountId: accounts[map.ar]!,
            debit: 0,
            credit: amountTtc,
            lineNo: 1,
            memo: 'AR credit TTC',
          },
          {
            accountId: accounts[map.revenue]!,
            debit: ht,
            credit: 0,
            lineNo: 2,
            memo: 'Revenue reverse HT',
          },
          {
            accountId: accounts[map.vat]!,
            debit: tax,
            credit: 0,
            lineNo: 3,
            memo: 'VAT reverse as-recorded',
          },
        ],
      });
    }

    const accounts = await this.resolveAccounts(companyId, [
      map.ar,
      map.revenue,
    ]);
    if (!accounts) {
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.ar}/${map.revenue}`,
      };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_credit_note',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description:
        input.description ?? `credit_note:${input.creditNoteId}`,
      journalCode: map.salesJournal,
      lines: [
        {
          accountId: accounts[map.ar]!,
          debit: 0,
          credit: amountTtc,
          lineNo: 1,
          memo: 'AR credit',
        },
        {
          accountId: accounts[map.revenue]!,
          debit: amountTtc,
          credit: 0,
          lineNo: 2,
          memo: 'Revenue reverse',
        },
      ],
    });
  }

  /**
   * Décomptabilisation facture — reverse all POSTED fin_invoice GL rows for invoice.
   * Idempotent on reverseSourceId.
   */
  async reverseInvoiceIssued(
    companyId: string,
    input: { invoiceId: string; reverseSourceId: string },
  ): Promise<FinanceGlPostResult> {
    const already = await this.findBySource(
      companyId,
      'fin_invoice_deaccount',
      input.reverseSourceId,
    );
    if (already) {
      return {
        outcome: 'existing',
        entryId: already.id,
        number: already.number,
      };
    }

    const marker = `invoice:${input.invoiceId}`;
    const targets = await this.prisma.accJournalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: AccEntryStatus.POSTED,
        sourceType: 'fin_invoice',
        OR: [
          { description: marker },
          { description: { startsWith: `${marker}` } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (targets.length === 0) {
      return { outcome: 'skipped', reason: 'no posted invoice GL to reverse' };
    }

    let last: { id: string; number: string } = {
      id: targets[0]!.id,
      number: targets[0]!.number,
    };
    for (const entry of targets) {
      try {
        const reversed = await this.accounting.reverseEntry(
          companyId,
          entry.id,
        );
        last = { id: reversed.id, number: reversed.number };
      } catch (error) {
        this.logger.warn(
          `GL deaccount failed for ${entry.number}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return { outcome: 'skipped', reason: 'reverse failed' };
      }
    }

    await this.prisma.accJournalEntry.update({
      where: { id: last.id },
      data: {
        sourceType: 'fin_invoice_deaccount',
        sourceId: input.reverseSourceId,
      },
    });

    return {
      outcome: 'posted',
      entryId: last.id,
      number: last.number,
    };
  }

  /** Payment allocated → Dr Banque / Cr Clients (mapped codes). */
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

    const map = await this.glMapping.resolve(companyId);
    const accounts = await this.resolveAccounts(companyId, [
      map.bank,
      map.ar,
    ]);
    if (!accounts) {
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.bank}/${map.ar}`,
      };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_payment_alloc',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description: `payment:${input.paymentId}`,
      journalCode: map.bankJournal,
      lines: [
        {
          accountId: accounts[map.bank]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'Bank',
        },
        {
          accountId: accounts[map.ar]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'AR settle',
        },
      ],
    });
  }

  /**
   * Explicit bank fee (D193) — Dr Frais bancaires / Cr Banque.
   * Requires Prefs `accounting.gl.bank_fee` (empty = skip). Journal = bank_journal.
   */
  async postBankFee(
    companyId: string,
    input: {
      sourceId: string;
      statementLineId: string;
      amount: number;
      entryDate: string;
    },
  ): Promise<FinanceGlPostResult> {
    const amount = round3(Math.abs(input.amount));
    if (amount <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_bank_fee',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const map = await this.glMapping.resolve(companyId);
    if (!map.bankFee.trim()) {
      return {
        outcome: 'skipped',
        reason: 'accounting.gl.bank_fee not configured',
      };
    }
    const accounts = await this.resolveAccounts(companyId, [
      map.bankFee,
      map.bank,
    ]);
    if (!accounts) {
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.bankFee}/${map.bank}`,
      };
    }

    return this.createAndPost(companyId, {
      sourceType: 'fin_bank_fee',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description: `bank_fee:${input.statementLineId}`,
      journalCode: map.bankJournal,
      lines: [
        {
          accountId: accounts[map.bankFee]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'Bank fee',
        },
        {
          accountId: accounts[map.bank]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'Bank',
        },
      ],
    });
  }

  /**
   * AP bill posted (D273/D276) — Dr Charges / Cr Fournisseurs (TTC as-recorded).
   * If amountTax > 0 and Prefs `accounting.gl.vat_input` mapped:
   * Dr expense HT / Dr VAT input / Cr AP TTC. Never invent input-VAT CoA.
   */
  async postApBillPosted(
    companyId: string,
    input: {
      sourceId: string;
      billId: string;
      amount: number;
      entryDate: string;
      description?: string;
      amountHt?: number;
      amountTax?: number;
    },
  ): Promise<FinanceGlPostResult> {
    const amount = round3(input.amount);
    if (amount <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_ap_bill',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const map = await this.glMapping.resolve(companyId);
    const tax = round3(input.amountTax ?? 0);
    const ht = round3(input.amountHt ?? 0);
    const vatCode = map.vatInput.trim();
    const splitVat = tax > 0 && ht > 0 && vatCode.length > 0;

    const accounts = await this.resolveAccounts(
      companyId,
      splitVat ? [map.expense, map.ap, vatCode] : [map.expense, map.ap],
    );
    if (!accounts) {
      if (splitVat) {
        const fallback = await this.resolveAccounts(companyId, [
          map.expense,
          map.ap,
        ]);
        if (!fallback) {
          return {
            outcome: 'skipped',
            reason: `missing CoA ${map.expense}/${map.ap}`,
          };
        }
        return this.postApBillTwoLine(
          companyId,
          input,
          amount,
          map,
          fallback,
        );
      }
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.expense}/${map.ap}`,
      };
    }

    if (splitVat) {
      return this.createAndPost(companyId, {
        sourceType: 'fin_ap_bill',
        sourceId: input.sourceId,
        entryDate: input.entryDate,
        description: input.description ?? `ap_bill:${input.billId}`,
        journalCode: map.purchasesJournal,
        lines: [
          {
            accountId: accounts[map.expense]!,
            debit: ht,
            credit: 0,
            lineNo: 1,
            memo: 'AP expense HT',
          },
          {
            accountId: accounts[vatCode]!,
            debit: tax,
            credit: 0,
            lineNo: 2,
            memo: 'VAT deductible',
          },
          {
            accountId: accounts[map.ap]!,
            debit: 0,
            credit: amount,
            lineNo: 3,
            memo: 'AP liability TTC',
          },
        ],
      });
    }

    return this.postApBillTwoLine(companyId, input, amount, map, accounts);
  }

  private postApBillTwoLine(
    companyId: string,
    input: { sourceId: string; billId: string; entryDate: string; description?: string },
    amount: number,
    map: { expense: string; ap: string; purchasesJournal: string },
    accounts: Record<string, string>,
  ): Promise<FinanceGlPostResult> {
    return this.createAndPost(companyId, {
      sourceType: 'fin_ap_bill',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description: input.description ?? `ap_bill:${input.billId}`,
      journalCode: map.purchasesJournal,
      lines: [
        {
          accountId: accounts[map.expense]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'AP expense',
        },
        {
          accountId: accounts[map.ap]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'AP liability',
        },
      ],
    });
  }

  /**
   * AP bill cancelled — reverse POSTED fin_ap_bill GL rows (D273).
   * Idempotent on reverseSourceId.
   */
  async reverseApBillPosted(
    companyId: string,
    input: { billId: string; reverseSourceId: string },
  ): Promise<FinanceGlPostResult> {
    const already = await this.findBySource(
      companyId,
      'fin_ap_bill_cancel',
      input.reverseSourceId,
    );
    if (already) {
      return {
        outcome: 'existing',
        entryId: already.id,
        number: already.number,
      };
    }

    const marker = `ap_bill:${input.billId}`;
    const targets = await this.prisma.accJournalEntry.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: AccEntryStatus.POSTED,
        sourceType: 'fin_ap_bill',
        OR: [
          { description: marker },
          { description: { startsWith: `${marker}` } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (targets.length === 0) {
      return { outcome: 'skipped', reason: 'no posted AP bill GL to reverse' };
    }

    let last: { id: string; number: string } = {
      id: targets[0]!.id,
      number: targets[0]!.number,
    };
    for (const entry of targets) {
      try {
        const reversed = await this.accounting.reverseEntry(
          companyId,
          entry.id,
        );
        last = { id: reversed.id, number: reversed.number };
      } catch (error) {
        this.logger.warn(
          `GL AP bill reverse failed for ${entry.number}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return { outcome: 'skipped', reason: 'reverse failed' };
      }
    }

    await this.prisma.accJournalEntry.update({
      where: { id: last.id },
      data: {
        sourceType: 'fin_ap_bill_cancel',
        sourceId: input.reverseSourceId,
      },
    });

    return {
      outcome: 'posted',
      entryId: last.id,
      number: last.number,
    };
  }

  /**
   * AP payment posted (D273/D275) — Dr Fournisseurs / Cr Banque (net).
   * If RAS withheld and Prefs `accounting.gl.ras` mapped to an active CoA:
   * Dr AP (gross) / Cr Banque (net) / Cr RAS (withheld). Never invent RAS CoA.
   */
  async postApPaymentPosted(
    companyId: string,
    input: {
      sourceId: string;
      apPaymentId: string;
      amount: number;
      entryDate: string;
      amountRas?: number;
      rasApplied?: boolean;
    },
  ): Promise<FinanceGlPostResult> {
    const amount = round3(input.amount);
    if (amount <= 0) {
      return { outcome: 'skipped', reason: 'non-positive amount' };
    }

    const existing = await this.findBySource(
      companyId,
      'fin_ap_payment',
      input.sourceId,
    );
    if (existing) {
      return {
        outcome: 'existing',
        entryId: existing.id,
        number: existing.number,
      };
    }

    const map = await this.glMapping.resolve(companyId);
    const rasAmount =
      input.rasApplied === true ? round3(input.amountRas ?? 0) : 0;
    const rasCode = map.ras.trim();
    const splitRas = rasAmount > 0 && rasCode.length > 0;

    const accounts = await this.resolveAccounts(
      companyId,
      splitRas ? [map.ap, map.bank, rasCode] : [map.ap, map.bank],
    );
    if (!accounts) {
      if (splitRas) {
        const fallback = await this.resolveAccounts(companyId, [
          map.ap,
          map.bank,
        ]);
        if (!fallback) {
          return {
            outcome: 'skipped',
            reason: `missing CoA ${map.ap}/${map.bank}`,
          };
        }
        return this.postApPaymentTwoLine(
          companyId,
          input,
          amount,
          map,
          fallback,
        );
      }
      return {
        outcome: 'skipped',
        reason: `missing CoA ${map.ap}/${map.bank}`,
      };
    }

    if (splitRas) {
      const gross = round3(amount + rasAmount);
      return this.createAndPost(companyId, {
        sourceType: 'fin_ap_payment',
        sourceId: input.sourceId,
        entryDate: input.entryDate,
        description: `ap_payment:${input.apPaymentId}`,
        journalCode: map.bankJournal,
        lines: [
          {
            accountId: accounts[map.ap]!,
            debit: gross,
            credit: 0,
            lineNo: 1,
            memo: 'AP settle (gross)',
          },
          {
            accountId: accounts[map.bank]!,
            debit: 0,
            credit: amount,
            lineNo: 2,
            memo: 'Bank (net)',
          },
          {
            accountId: accounts[rasCode]!,
            debit: 0,
            credit: rasAmount,
            lineNo: 3,
            memo: 'RAS withheld',
          },
        ],
      });
    }

    return this.postApPaymentTwoLine(companyId, input, amount, map, accounts);
  }

  private postApPaymentTwoLine(
    companyId: string,
    input: { sourceId: string; apPaymentId: string; entryDate: string },
    amount: number,
    map: { ap: string; bank: string; bankJournal: string },
    accounts: Record<string, string>,
  ): Promise<FinanceGlPostResult> {
    return this.createAndPost(companyId, {
      sourceType: 'fin_ap_payment',
      sourceId: input.sourceId,
      entryDate: input.entryDate,
      description: `ap_payment:${input.apPaymentId}`,
      journalCode: map.bankJournal,
      lines: [
        {
          accountId: accounts[map.ap]!,
          debit: amount,
          credit: 0,
          lineNo: 1,
          memo: 'AP settle',
        },
        {
          accountId: accounts[map.bank]!,
          debit: 0,
          credit: amount,
          lineNo: 2,
          memo: 'Bank',
        },
      ],
    });
  }

  /** Reverse posted payment allocation GL (instrument reject or payment.reverse). */
  async reversePaymentOnInstrumentReject(
    companyId: string,
    input: {
      paymentId: string;
      rejectSourceId: string;
      /** Idempotency sourceType — default instrument reject. */
      sourceType?: 'fin_instrument_reject' | 'fin_payment_reverse';
    },
  ): Promise<FinanceGlPostResult> {
    const sourceType = input.sourceType ?? 'fin_instrument_reject';
    const already = await this.findBySource(
      companyId,
      sourceType,
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

    let last: { id: string; number: string } = {
      id: targets[0]!.id,
      number: targets[0]!.number,
    };
    for (const entry of targets) {
      try {
        const reversed = await this.accounting.reverseEntry(
          companyId,
          entry.id,
        );
        last = { id: reversed.id, number: reversed.number };
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
        sourceType,
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

  /**
   * Period for Finance→GL (D198): must cover entryDate and be OPEN.
   * No fallback to another month — closed covering period blocks posting.
   */
  private async resolvePeriodForPost(
    companyId: string,
    entryDate: string,
  ): Promise<{ ok: true; periodId: string } | { ok: false; reason: string }> {
    const d = new Date(`${entryDate}T00:00:00.000Z`);
    const covering = await this.prisma.accFiscalPeriod.findFirst({
      where: {
        companyId,
        deletedAt: null,
        startDate: { lte: d },
        endDate: { gte: d },
      },
    });
    if (!covering) {
      return { ok: false, reason: 'no fiscal period covering entry date' };
    }
    if (covering.status !== AccPeriodStatus.OPEN) {
      return {
        ok: false,
        reason: `ACC.PERIOD_CLOSED: period ${covering.code} is ${covering.status}`,
      };
    }
    return { ok: true, periodId: covering.id };
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
    const period = await this.resolvePeriodForPost(
      companyId,
      input.entryDate,
    );
    if (!period.ok) {
      return { outcome: 'skipped', reason: period.reason };
    }

    try {
      const draft = await this.accounting.createEntry(companyId, {
        journalId,
        periodId: period.periodId,
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

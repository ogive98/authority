import { DEFAULT_GL_CODES } from './accounting.constants';
import { FinanceGlPostingService } from './finance-gl-posting.service';

describe('FinanceGlPostingService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const glMapping = {
    resolve: jest.fn().mockResolvedValue({
      ar: DEFAULT_GL_CODES.ar,
      bank: DEFAULT_GL_CODES.bank,
      revenue: DEFAULT_GL_CODES.revenue,
      vat: DEFAULT_GL_CODES.vat,
      bankFee: '',
      salesJournal: DEFAULT_GL_CODES.salesJournal,
      bankJournal: DEFAULT_GL_CODES.bankJournal,
    }),
  };

  it('skips invoice post when CoA missing', async () => {
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const accounting = {
      createEntry: jest.fn(),
      postEntry: jest.fn(),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postInvoiceIssued(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      invoiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      amount: 100,
      entryDate: '2026-09-07',
    });
    expect(result).toEqual({
      outcome: 'skipped',
      reason: 'missing CoA 411/701',
    });
    expect(accounting.createEntry).not.toHaveBeenCalled();
  });

  it('returns existing when source already posted', async () => {
    const prisma = {
      accJournalEntry: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'je-1',
          number: 'JE-2026-0001',
        }),
      },
    };
    const accounting = {
      createEntry: jest.fn(),
      postEntry: jest.fn(),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postPaymentAllocated(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      paymentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      amount: 40,
      entryDate: '2026-09-07',
    });
    expect(result.outcome).toBe('existing');
    expect(accounting.createEntry).not.toHaveBeenCalled();
  });

  it('posts VAT split when HT+tax as-recorded and CoA present', async () => {
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: {
        findMany: jest.fn().mockResolvedValue([
          { code: '411', id: 'a-ar' },
          { code: '701', id: 'a-rev' },
          { code: '4367', id: 'a-vat' },
        ]),
      },
      accJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'j-ven' }),
      },
      accFiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-1',
          code: '2026-09',
          status: 'OPEN',
        }),
      },
    };
    const accounting = {
      createEntry: jest.fn().mockResolvedValue({ id: 'draft-1' }),
      postEntry: jest
        .fn()
        .mockResolvedValue({ id: 'posted-1', number: 'JE-1' }),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postInvoiceIssued(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      invoiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      amount: 119,
      amountHt: 100,
      amountTax: 19,
      entryDate: '2026-09-07',
    });
    expect(result.outcome).toBe('posted');
    expect(accounting.createEntry).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        lines: expect.arrayContaining([
          expect.objectContaining({ debit: 119, memo: 'AR TTC' }),
          expect.objectContaining({ credit: 100, memo: 'Revenue HT' }),
          expect.objectContaining({ credit: 19, memo: 'VAT as-recorded' }),
        ]),
      }),
    );
  });

  it('posts credit note VAT split as inverse of invoice', async () => {
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: {
        findMany: jest.fn().mockResolvedValue([
          { code: '411', id: 'a-ar' },
          { code: '701', id: 'a-rev' },
          { code: '4367', id: 'a-vat' },
        ]),
      },
      accJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'j-ven' }),
      },
      accFiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-1',
          code: '2026-09',
          status: 'OPEN',
        }),
      },
    };
    const accounting = {
      createEntry: jest.fn().mockResolvedValue({ id: 'draft-cn' }),
      postEntry: jest
        .fn()
        .mockResolvedValue({ id: 'posted-cn', number: 'JE-CN' }),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postCreditNoteIssued(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      creditNoteId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      amount: 119,
      amountHt: 100,
      amountTax: 19,
      entryDate: '2026-09-11',
    });
    expect(result.outcome).toBe('posted');
    expect(accounting.createEntry).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        sourceType: 'fin_credit_note',
        lines: expect.arrayContaining([
          expect.objectContaining({ credit: 119, memo: 'AR credit TTC' }),
          expect.objectContaining({ debit: 100, memo: 'Revenue reverse HT' }),
          expect.objectContaining({
            debit: 19,
            memo: 'VAT reverse as-recorded',
          }),
        ]),
      }),
    );
  });

  it('skips bank fee when Prefs bank_fee empty', async () => {
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const accounting = {
      createEntry: jest.fn(),
      postEntry: jest.fn(),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postBankFee(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      statementLineId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      amount: 5.25,
      entryDate: '2026-09-11',
    });
    expect(result).toEqual({
      outcome: 'skipped',
      reason: 'accounting.gl.bank_fee not configured',
    });
    expect(accounting.createEntry).not.toHaveBeenCalled();
  });

  it('posts bank fee Dr fee / Cr bank when mapped', async () => {
    glMapping.resolve.mockResolvedValueOnce({
      ar: DEFAULT_GL_CODES.ar,
      bank: DEFAULT_GL_CODES.bank,
      revenue: DEFAULT_GL_CODES.revenue,
      vat: DEFAULT_GL_CODES.vat,
      bankFee: '627',
      salesJournal: DEFAULT_GL_CODES.salesJournal,
      bankJournal: DEFAULT_GL_CODES.bankJournal,
    });
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: {
        findMany: jest.fn().mockResolvedValue([
          { code: '627', id: 'a-fee' },
          { code: '512', id: 'a-bank' },
        ]),
      },
      accJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'j-bq' }),
      },
      accFiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-open',
          code: '2026-09',
          status: 'OPEN',
        }),
      },
    };
    const accounting = {
      createEntry: jest.fn().mockResolvedValue({ id: 'draft-fee' }),
      postEntry: jest
        .fn()
        .mockResolvedValue({ id: 'posted-fee', number: 'JE-FEE' }),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postBankFee(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      statementLineId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      amount: -5.25,
      entryDate: '2026-09-11',
    });
    expect(result.outcome).toBe('posted');
    expect(accounting.createEntry).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        sourceType: 'fin_bank_fee',
        journalId: 'j-bq',
        lines: [
          expect.objectContaining({
            accountId: 'a-fee',
            debit: 5.25,
            credit: 0,
          }),
          expect.objectContaining({
            accountId: 'a-bank',
            debit: 0,
            credit: 5.25,
          }),
        ],
      }),
    );
  });

  it('deaccounts invoice GL via reverse', async () => {
    const prisma = {
      accJournalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          { id: 'je-1', number: 'JE-1' },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const accounting = {
      createEntry: jest.fn(),
      postEntry: jest.fn(),
      reverseEntry: jest
        .fn()
        .mockResolvedValue({ id: 'rev-1', number: 'JE-2' }),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const invoiceId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const result = await svc.reverseInvoiceIssued(companyId, {
      invoiceId,
      reverseSourceId: `manual-deaccount:${invoiceId}`,
    });
    expect(result).toEqual({
      outcome: 'posted',
      entryId: 'rev-1',
      number: 'JE-2',
    });
    expect(accounting.reverseEntry).toHaveBeenCalledWith(companyId, 'je-1');
  });

  it('skips Finance→GL when covering fiscal period is CLOSED (D198)', async () => {
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: {
        findMany: jest.fn().mockResolvedValue([
          { code: '411', id: 'a-ar' },
          { code: '701', id: 'a-rev' },
        ]),
      },
      accJournal: {
        findFirst: jest.fn().mockResolvedValue({ id: 'j-ven' }),
      },
      accFiscalPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p-closed',
          code: '2026-09',
          status: 'CLOSED',
        }),
      },
    };
    const accounting = {
      createEntry: jest.fn(),
      postEntry: jest.fn(),
      reverseEntry: jest.fn(),
    };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      glMapping as never,
    );
    const result = await svc.postPaymentAllocated(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      paymentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      amount: 40,
      entryDate: '2026-09-07',
    });
    expect(result).toEqual({
      outcome: 'skipped',
      reason: 'ACC.PERIOD_CLOSED: period 2026-09 is CLOSED',
    });
    expect(accounting.createEntry).not.toHaveBeenCalled();
  });
});

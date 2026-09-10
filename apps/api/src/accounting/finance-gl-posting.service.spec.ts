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
        findFirst: jest.fn().mockResolvedValue({ id: 'p-1' }),
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
});

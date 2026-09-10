import { FinanceGlPostingService } from './finance-gl-posting.service';
import { DEFAULT_GL_CODES } from './accounting.constants';

describe('FinanceGlPostingService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const glMapping = {
    resolve: jest.fn().mockResolvedValue({
      ar: DEFAULT_GL_CODES.ar,
      bank: DEFAULT_GL_CODES.bank,
      revenue: DEFAULT_GL_CODES.revenue,
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
    const accounting = { createEntry: jest.fn(), postEntry: jest.fn() };
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

  it('uses company-mapped CoA codes when prefs override defaults', async () => {
    const customMap = {
      resolve: jest.fn().mockResolvedValue({
        ar: '4111',
        bank: '512',
        revenue: '7011',
        salesJournal: 'VEN',
        bankJournal: 'BQ',
      }),
    };
    const prisma = {
      accJournalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      accAccount: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const accounting = { createEntry: jest.fn(), postEntry: jest.fn() };
    const svc = new FinanceGlPostingService(
      prisma as never,
      accounting as never,
      customMap as never,
    );
    const result = await svc.postInvoiceIssued(companyId, {
      sourceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      invoiceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      amount: 100,
      entryDate: '2026-09-07',
    });
    expect(result).toEqual({
      outcome: 'skipped',
      reason: 'missing CoA 4111/7011',
    });
    expect(prisma.accAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          code: { in: ['4111', '7011'] },
        }),
      }),
    );
  });
});

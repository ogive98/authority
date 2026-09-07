import { FinanceGlPostingService } from './finance-gl-posting.service';

describe('FinanceGlPostingService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

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
});

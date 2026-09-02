import { formatDocumentNumber, NumberingService } from './numbering.service';

describe('formatDocumentNumber', () => {
  it('pads the sequence with the series padding', () => {
    expect(formatDocumentNumber('INV-', 2026, 42, 6)).toBe('INV-2026-000042');
  });
});

describe('NumberingService', () => {
  it('throws PLT.SERIES_MISSING when the series does not exist', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const auditService = { append: jest.fn() };
    const outboxService = { enqueue: jest.fn() };
    const service = new NumberingService(
      prisma as never,
      auditService as never,
      outboxService as never,
    );

    prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => {
      const tx = {
        coreNumberingSeries: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      return fn(tx);
    });

    await expect(
      service.allocate({
        companyId: 'company-id',
        docType: 'INVOICE',
        year: 2026,
        actorUserId: 'user-id',
      }),
    ).rejects.toMatchObject({
      response: { code: 'PLT.SERIES_MISSING' },
    });
  });
});

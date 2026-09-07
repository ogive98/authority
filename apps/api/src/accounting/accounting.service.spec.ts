import { HttpStatus } from '@nestjs/common';
import {
  AccAccountType,
  AccEntryStatus,
  AccPeriodStatus,
  Prisma,
} from '@prisma/client';
import { ACCOUNTING_ERROR_CODES } from './accounting.constants';
import { AccountingService } from './accounting.service';

describe('AccountingService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const accountBankId = '22222222-2222-2222-2222-222222222222';
  const accountSalesId = '33333333-3333-3333-3333-333333333333';
  const journalId = '44444444-4444-4444-4444-444444444444';
  const periodId = '55555555-5555-5555-5555-555555555555';
  const yearId = '66666666-6666-6666-6666-666666666666';
  const entryId = '77777777-7777-7777-7777-777777777777';

  function build(opts?: { periodStatus?: AccPeriodStatus; entryStatus?: AccEntryStatus }) {
    const bank = {
      id: accountBankId,
      companyId,
      code: '512',
      name: 'Banque',
      type: AccAccountType.ASSET,
      active: true,
      version: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null as Date | null,
    };
    const sales = {
      id: accountSalesId,
      companyId,
      code: '701',
      name: 'Ventes',
      type: AccAccountType.REVENUE,
      active: true,
      version: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null as Date | null,
    };
    const journal = {
      id: journalId,
      companyId,
      code: 'VEN',
      name: 'Ventes',
      active: true,
      version: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null as Date | null,
    };
    const period = {
      id: periodId,
      companyId,
      fiscalYearId: yearId,
      code: '2026-01',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-01-31T00:00:00.000Z'),
      status: opts?.periodStatus ?? AccPeriodStatus.OPEN,
      version: 0,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null as Date | null,
    };

    let entry = {
      id: entryId,
      companyId,
      journalId,
      periodId,
      number: 'JE-2026-0001',
      status: opts?.entryStatus ?? AccEntryStatus.DRAFT,
      entryDate: new Date('2026-01-15T00:00:00.000Z'),
      description: 'Vente démo',
      sourceType: null as string | null,
      sourceId: null as string | null,
      postedAt: null as Date | null,
      version: 0,
      createdAt: new Date('2026-01-15T00:00:00.000Z'),
      updatedAt: new Date('2026-01-15T00:00:00.000Z'),
      deletedAt: null as Date | null,
      lines: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          companyId,
          entryId,
          accountId: accountBankId,
          debit: new Prisma.Decimal(100),
          credit: new Prisma.Decimal(0),
          memo: null as string | null,
          lineNo: 1,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          account: bank,
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          companyId,
          entryId,
          accountId: accountSalesId,
          debit: new Prisma.Decimal(0),
          credit: new Prisma.Decimal(100),
          memo: null as string | null,
          lineNo: 2,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          account: sales,
        },
      ],
      journal,
      period,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      accAccount: {
        findMany: jest.fn().mockResolvedValue([bank, sales]),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...bank,
            ...data,
            id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
      accJournal: {
        findMany: jest.fn().mockResolvedValue([journal]),
        findFirst: jest.fn().mockResolvedValue(journal),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...journal,
            ...data,
            id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
      accFiscalYear: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: yearId,
          companyId,
          code: '2026',
          deletedAt: null,
        }),
        findFirstOrThrow: jest.fn(),
        create: jest.fn(),
      },
      accFiscalPeriod: {
        findMany: jest.fn().mockResolvedValue([period]),
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
          if (where?.id && where.id !== periodId) return Promise.resolve(null);
          return Promise.resolve({ ...period });
        }),
        create: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            ...period,
            status: (data.status as AccPeriodStatus) ?? period.status,
            version: period.version + 1,
          }),
        ),
      },
      accJournalEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
          if (where?.id && where.id !== entryId) return Promise.resolve(null);
          return Promise.resolve({
            ...entry,
            lines: [...entry.lines],
            journal,
            period: { ...period },
          });
        }),
        findFirstOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            ...entry,
            lines: [...entry.lines],
            journal,
            period: { ...period },
          }),
        ),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          const created = {
            ...entry,
            ...data,
            id: entryId,
            status: (data.status as AccEntryStatus) ?? AccEntryStatus.DRAFT,
            lines: entry.lines,
            journal,
            period: { ...period },
          };
          entry = created as typeof entry;
          return Promise.resolve(created);
        }),
        update: jest.fn(),
        updateMany: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          entry = {
            ...entry,
            status: (data.status as AccEntryStatus) ?? entry.status,
            postedAt: (data.postedAt as Date) ?? entry.postedAt,
            version: entry.version + 1,
          };
          return Promise.resolve({ count: 1 });
        }),
      },
      accJournalLine: {
        findMany: jest.fn().mockResolvedValue([
          {
            accountId: accountBankId,
            debit: new Prisma.Decimal(100),
            credit: new Prisma.Decimal(0),
            account: bank,
          },
          {
            accountId: accountSalesId,
            debit: new Prisma.Decimal(0),
            credit: new Prisma.Decimal(100),
            account: sales,
          },
        ]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new AccountingService(prisma as never, outbox as never);
    return { service, prisma, outbox, getEntry: () => entry, period, bank, sales };
  }

  it('creates an account and emits outbox event', async () => {
    const { service, outbox } = build();
    const row = await service.createAccount(companyId, {
      code: '411',
      name: 'Clients',
      type: AccAccountType.ASSET,
    });
    expect(row.code).toBe('411');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'accounting.account.created.v1',
      }),
    );
  });

  it('rejects unbalanced draft lines', async () => {
    const { service } = build();
    await expect(
      service.createEntry(companyId, {
        journalId,
        periodId,
        entryDate: '2026-01-15',
        lines: [
          { accountId: accountBankId, debit: 100, credit: 0, lineNo: 1 },
          { accountId: accountSalesId, debit: 0, credit: 50, lineNo: 2 },
        ],
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({ code: ACCOUNTING_ERROR_CODES.UNBALANCED }),
    });
  });

  it('posts a draft when period is OPEN', async () => {
    const { service, outbox, getEntry } = build();
    const posted = await service.postEntry(companyId, entryId);
    expect(posted.status).toBe(AccEntryStatus.POSTED);
    expect(getEntry().status).toBe(AccEntryStatus.POSTED);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'accounting.entry.posted.v1',
      }),
    );
  });

  it('refuses post when period is CLOSED', async () => {
    const { service } = build({ periodStatus: AccPeriodStatus.CLOSED });
    await expect(service.postEntry(companyId, entryId)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({
        code: ACCOUNTING_ERROR_CODES.PERIOD_CLOSED,
      }),
    });
  });

  it('refuses post when period is SOFT_CLOSED (V0 OPEN only)', async () => {
    const { service } = build({ periodStatus: AccPeriodStatus.SOFT_CLOSED });
    await expect(service.postEntry(companyId, entryId)).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: expect.objectContaining({
        code: ACCOUNTING_ERROR_CODES.PERIOD_CLOSED,
      }),
    });
  });

  it('aggregates trial balance from posted lines', async () => {
    const { service } = build();
    const tb = await service.trialBalance(companyId, { periodId });
    expect(tb.items).toHaveLength(2);
    expect(tb.items.find((r) => r.accountCode === '512')?.debit).toBe('100.000');
    expect(tb.items.find((r) => r.accountCode === '701')?.credit).toBe('100.000');
  });
});

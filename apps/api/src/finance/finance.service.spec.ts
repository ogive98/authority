import { HttpStatus } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinOpenItemStatus,
  Prisma,
} from '@prisma/client';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const otherCustomerId = '33333333-3333-3333-3333-333333333333';
  const openItemId = '44444444-4444-4444-4444-444444444444';

  function build(opts?: {
    amountOpen?: number;
    status?: FinOpenItemStatus;
    customerId?: string;
  }) {
    let item = {
      id: openItemId,
      companyId,
      number: 'FIN-2026-0001',
      customerId: opts?.customerId ?? customerId,
      side: FinOpenItemSide.AR,
      status: opts?.status ?? FinOpenItemStatus.OPEN,
      salesOrderId: null as string | null,
      currency: 'TND',
      amountTotal: new Prisma.Decimal(50),
      amountOpen: new Prisma.Decimal(opts?.amountOpen ?? 50),
      dueDate: null as Date | null,
      label: 'Créance démo',
      notes: null as string | null,
      version: 0,
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
      updatedAt: new Date('2026-09-01T10:00:00.000Z'),
      deletedAt: null as Date | null,
      allocations: [] as Array<{
        id: string;
        amount: Prisma.Decimal;
        paidAt: Date;
        note: string | null;
      }>,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      finOpenItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
          if (where?.id && where.id !== openItemId) {
            return Promise.resolve(null);
          }
          return Promise.resolve({ ...item, allocations: [...item.allocations] });
        }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          item = {
            ...item,
            ...data,
            id: openItemId,
            amountTotal: new Prisma.Decimal(data.amountTotal as number),
            amountOpen: new Prisma.Decimal(data.amountOpen as number),
            status: (data.status as FinOpenItemStatus) ?? FinOpenItemStatus.OPEN,
            allocations: [],
          };
          return Promise.resolve({ ...item, allocations: [] });
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          item = {
            ...item,
            amountOpen:
              data.amountOpen != null
                ? new Prisma.Decimal(data.amountOpen as number)
                : item.amountOpen,
            status: (data.status as FinOpenItemStatus) ?? item.status,
            version: item.version + 1,
          };
          return Promise.resolve({
            ...item,
            allocations: [...item.allocations],
          });
        }),
        updateMany: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          item = {
            ...item,
            amountOpen:
              data.amountOpen != null
                ? new Prisma.Decimal(data.amountOpen as number)
                : item.amountOpen,
            status: (data.status as FinOpenItemStatus) ?? item.status,
            version: item.version + 1,
          };
          return Promise.resolve({ count: 1 });
        }),
        findFirstOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({ ...item, allocations: [...item.allocations] }),
        ),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amountOpen: item.amountOpen },
        }),
      },
      finAllocation: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          const row = {
            id: '55555555-5555-5555-5555-555555555555',
            amount: new Prisma.Decimal(data.amount as number),
            paidAt: (data.paidAt as Date) ?? new Date(),
            note: (data.note as string | null) ?? null,
          };
          item.allocations = [row, ...item.allocations];
          return Promise.resolve(row);
        }),
      },
      cusCustomer: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string } }) => {
          if (where?.id === otherCustomerId) {
            return Promise.resolve(null);
          }
          return Promise.resolve({
            id: customerId,
            code: 'PORTAL-DEMO',
            creditLimit: new Prisma.Decimal(1000),
            party: { legalName: 'Portal Demo Client' },
          });
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'PORTAL-DEMO',
            party: { legalName: 'Portal Demo Client' },
          },
        ]),
      },
      salOrder: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new FinanceService(prisma as never, outbox as never);
    return { service, prisma, outbox, getItem: () => item };
  }

  it('creates an AR open item with amount as recorded', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, {
      customerId,
      amountTotal: 50,
      label: 'Créance démo',
    });
    expect(dto.amountTotal).toBe('50.000');
    expect(dto.amountOpen).toBe('50.000');
    expect(dto.status).toBe(FinOpenItemStatus.OPEN);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.open_item.created.v1',
      }),
    );
  });

  it('rejects unknown customer', async () => {
    const { service } = build();
    await expect(
      service.create(companyId, {
        customerId: otherCustomerId,
        amountTotal: 10,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: FINANCE_ERROR_CODES.CUSTOMER_NOT_FOUND },
    });
  });

  it('allocates partially then closes on full pay', async () => {
    const { service, outbox } = build({ amountOpen: 50 });
    const partial = await service.allocate(companyId, openItemId, {
      amount: 20,
    });
    expect(partial.status).toBe(FinOpenItemStatus.PARTIAL);
    expect(partial.amountOpen).toBe('30.000');

    const closed = await service.allocate(companyId, openItemId, {
      amount: 30,
    });
    expect(closed.status).toBe(FinOpenItemStatus.CLOSED);
    expect(closed.amountOpen).toBe('0.000');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.allocation.recorded.v1',
      }),
    );
  });

  it('rejects over-allocation', async () => {
    const { service } = build({ amountOpen: 10 });
    await expect(
      service.allocate(companyId, openItemId, { amount: 11 }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: FINANCE_ERROR_CODES.OVER_ALLOCATE },
    });
  });

  it('rejects allocate on closed item', async () => {
    const { service } = build({
      status: FinOpenItemStatus.CLOSED,
      amountOpen: 0,
    });
    await expect(
      service.allocate(companyId, openItemId, { amount: 1 }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: FINANCE_ERROR_CODES.INVALID_STATUS },
    });
  });

  it('returns credit snapshot with outstanding balance', async () => {
    const { service } = build({ amountOpen: 50 });
    const snap = await service.creditSnapshot(companyId, customerId);
    expect(snap.outstandingBalance).toBe('50.000');
    expect(snap.creditLimit).toBe('1000.000');
    expect(snap.currency).toBe('TND');
  });

  it('get returns NOT_FOUND for missing id (IDOR-safe shape)', async () => {
    const { service } = build();
    await expect(
      service.get(companyId, '99999999-9999-9999-9999-999999999999'),
    ).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: FINANCE_ERROR_CODES.NOT_FOUND },
    });
  });
});

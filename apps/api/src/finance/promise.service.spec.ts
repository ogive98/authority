import { HttpStatus } from '@nestjs/common';
import {
  FinOpenItemSide,
  FinOpenItemStatus,
  FinPromiseStatus,
  Prisma,
} from '@prisma/client';
import { FINANCE_ERROR_CODES } from './finance.constants';
import { PromiseService } from './promise.service';

describe('PromiseService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const openItemId = '44444444-4444-4444-4444-444444444444';
  const promiseId = '77777777-7777-7777-7777-777777777777';

  function build(opts?: {
    amountOpen?: number;
    openStatus?: FinOpenItemStatus;
    existingOpenPromise?: boolean;
    promiseStatus?: FinPromiseStatus;
    promisedDate?: Date;
  }) {
    const openItem = {
      id: openItemId,
      companyId,
      number: 'FIN-2026-0001',
      customerId,
      side: FinOpenItemSide.AR,
      status: opts?.openStatus ?? FinOpenItemStatus.OPEN,
      currency: 'TND',
      amountOpen: new Prisma.Decimal(opts?.amountOpen ?? 50),
      deletedAt: null as Date | null,
    };

    let promise = {
      id: promiseId,
      companyId,
      number: 'PTP-2026-0001',
      customerId,
      openItemId,
      amount: new Prisma.Decimal(25),
      currency: 'TND',
      promisedDate: opts?.promisedDate ?? new Date('2026-09-15T00:00:00.000Z'),
      status: opts?.promiseStatus ?? FinPromiseStatus.OPEN,
      notes: null as string | null,
      version: 0,
      createdAt: new Date('2026-09-08T10:00:00.000Z'),
      updatedAt: new Date('2026-09-08T10:00:00.000Z'),
      deletedAt: null as Date | null,
    };

    const existingOpen = opts?.existingOpenPromise
      ? { ...promise, id: '88888888-8888-8888-8888-888888888888' }
      : null;

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      finOpenItem: {
        findFirst: jest.fn().mockResolvedValue(openItem),
        findMany: jest.fn().mockResolvedValue([
          { id: openItemId, number: openItem.number },
        ]),
      },
      finPromiseToPay: {
        findFirst: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where?: { id?: string; status?: FinPromiseStatus };
            }) => {
              if (where?.status === FinPromiseStatus.OPEN && existingOpen) {
                return Promise.resolve(existingOpen);
              }
              if (where?.id && where.id !== promiseId) {
                return Promise.resolve(null);
              }
              if (where?.id === promiseId || !where?.id) {
                return Promise.resolve(
                  where?.status === FinPromiseStatus.OPEN && !existingOpen
                    ? null
                    : { ...promise },
                );
              }
              return Promise.resolve(null);
            },
          ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          promise = {
            ...promise,
            ...data,
            id: promiseId,
            amount: new Prisma.Decimal(data.amount as number),
            status: FinPromiseStatus.OPEN,
          };
          return Promise.resolve({ ...promise });
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          promise = {
            ...promise,
            status: (data.status as FinPromiseStatus) ?? promise.status,
            version: promise.version + 1,
          };
          return Promise.resolve({ ...promise });
        }),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C-DEMO',
            party: { legalName: 'Demo Client' },
          },
        ]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new PromiseService(prisma as never, outbox as never);
    return { service, prisma, outbox, getPromise: () => promise };
  }

  it('creates a promise against an open item', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, {
      openItemId,
      amount: 25,
      promisedDate: '2026-09-20',
      notes: 'Appel client',
    });
    expect(dto.status).toBe(FinPromiseStatus.OPEN);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.promise.created.v1',
      }),
    );
  });

  it('rejects amount above open balance', async () => {
    const { service } = build({ amountOpen: 10 });
    await expect(
      service.create(companyId, {
        openItemId,
        amount: 11,
        promisedDate: '2026-09-20',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: FINANCE_ERROR_CODES.INVALID_AMOUNT },
    });
  });

  it('rejects second OPEN promise on same open item', async () => {
    const { service } = build({ existingOpenPromise: true });
    await expect(
      service.create(companyId, {
        openItemId,
        amount: 10,
        promisedDate: '2026-09-20',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: FINANCE_ERROR_CODES.PROMISE_EXISTS },
    });
  });

  it('cancels an OPEN promise', async () => {
    const { service, outbox, prisma } = build();
    prisma.finPromiseToPay.findFirst = jest.fn().mockResolvedValue({
      id: promiseId,
      companyId,
      number: 'PTP-2026-0001',
      customerId,
      openItemId,
      amount: new Prisma.Decimal(25),
      currency: 'TND',
      promisedDate: new Date('2026-09-15T00:00:00.000Z'),
      status: FinPromiseStatus.OPEN,
      notes: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const dto = await service.cancel(companyId, promiseId);
    expect(dto.status).toBe(FinPromiseStatus.CANCELLED);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.promise.status.v1',
      }),
    );
  });

  it('lazy-breaks overdue OPEN promises', async () => {
    const past = new Date('2020-01-01T00:00:00.000Z');
    const { service, outbox, prisma } = build({ promisedDate: past });
    prisma.finPromiseToPay.findMany = jest.fn().mockResolvedValue([
      {
        id: promiseId,
        companyId,
        customerId,
        openItemId,
        status: FinPromiseStatus.OPEN,
        promisedDate: past,
      },
    ]);
    const n = await service.breakOverdue(companyId);
    expect(n).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'finance.promise.status.v1',
        payloadJson: expect.objectContaining({
          status: FinPromiseStatus.BROKEN,
        }),
      }),
    );
  });

  it('marks OPEN promises KEPT when open item closes', async () => {
    const { service, outbox, prisma } = build();
    prisma.finPromiseToPay.findMany = jest.fn().mockResolvedValue([
      {
        id: promiseId,
        companyId,
        openItemId,
        status: FinPromiseStatus.OPEN,
      },
    ]);
    await service.markKeptForClosedOpenItem(
      prisma,
      companyId,
      openItemId,
      customerId,
    );
    expect(prisma.finPromiseToPay.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: FinPromiseStatus.KEPT }),
      }),
    );
    expect(outbox.enqueue).toHaveBeenCalled();
  });
});

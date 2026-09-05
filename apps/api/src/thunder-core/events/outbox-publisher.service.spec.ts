import {
  clampOutboxBatchSize,
  resolveOutboxBatchSize,
  OutboxPublisherService,
} from './outbox-publisher.service';

describe('resolveOutboxBatchSize', () => {
  it('defaults to 100', () => {
    expect(resolveOutboxBatchSize(undefined)).toBe(100);
  });

  it('clamps to 1–200', () => {
    expect(resolveOutboxBatchSize('0')).toBe(1);
    expect(resolveOutboxBatchSize('500')).toBe(200);
    expect(resolveOutboxBatchSize('50')).toBe(50);
    expect(clampOutboxBatchSize(75)).toBe(75);
  });
});

describe('OutboxPublisherService', () => {
  it('claims with transaction and marks published after XADD', async () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      companyId: '22222222-2222-2222-2222-222222222222',
      aggregateType: 'thunder_test',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      eventType: 'thunder.test.event.v1',
      eventVersion: 1,
      payloadJson: { source: 'thunder', payload: { ok: true } },
      headers: null,
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
      publishedAt: null,
      publishAttempts: 0,
    };

    type UpdateArg = {
      where: { id: string };
      data: { publishedAt: Date; publishAttempts: { increment: number } };
    };
    let lastUpdate: UpdateArg | undefined;
    const update = jest.fn((arg: UpdateArg) => {
      lastUpdate = arg;
      return Promise.resolve({});
    });
    const queryRaw = jest.fn().mockResolvedValue([row]);
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<number>) =>
        fn({
          $queryRaw: queryRaw,
          coreOutbox: { update },
        }),
      ),
    };
    const xadd = jest.fn().mockResolvedValue('1-0');
    const redis = {
      createBullConnection: jest.fn().mockReturnValue({
        xadd,
        disconnect: jest.fn(),
      }),
    };

    const service = new OutboxPublisherService(prisma as never, redis as never);

    const published = await service.publishDue(10);
    expect(published).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(queryRaw).toHaveBeenCalled();
    expect(xadd).toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(lastUpdate).toBeDefined();
    expect(lastUpdate!.where.id).toBe(row.id);
    expect(lastUpdate!.data.publishAttempts).toEqual({ increment: 1 });
    expect(lastUpdate!.data.publishedAt).toBeInstanceOf(Date);
  });

  it('leaves row unpublished when XADD fails', async () => {
    const row = {
      id: '11111111-1111-1111-1111-111111111111',
      companyId: null,
      aggregateType: 'thunder_test',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      eventType: 'thunder.test.event.v1',
      eventVersion: 1,
      payloadJson: {},
      headers: null,
      createdAt: new Date(),
      publishedAt: null,
      publishAttempts: 0,
    };

    const update = jest.fn();
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<number>) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([row]),
          coreOutbox: { update },
        }),
      ),
    };
    const redis = {
      createBullConnection: jest.fn().mockReturnValue({
        xadd: jest.fn().mockRejectedValue(new Error('redis down')),
        disconnect: jest.fn(),
      }),
    };

    const service = new OutboxPublisherService(prisma as never, redis as never);
    const published = await service.publishDue(5);
    expect(published).toBe(0);
    expect(update).not.toHaveBeenCalled();
  });
});

import { scrubSecrets } from '../../common/json-safety';
import { OutboxDlqService } from './outbox-dlq.service';

describe('OutboxDlqService', () => {
  it('records scrubbed payload and lists without payload body', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'dlq-1' });
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'dlq-1',
        outboxId: 'ob-1',
        companyId: null,
        aggregateType: 't',
        aggregateId: '22222222-2222-2222-2222-222222222222',
        eventType: 'thunder.test.v1',
        eventVersion: 1,
        lastError: 'boom',
        publishAttempts: 5,
        createdAt: new Date(),
        failedAt: new Date(),
      },
    ]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      coreOutboxDlq: { findMany, count },
    };
    const service = new OutboxDlqService(prisma as never);

    const tx = {
      coreOutboxDlq: { create },
    };

    await service.record(tx as never, {
      outboxId: 'ob-1',
      companyId: null,
      aggregateType: 't',
      aggregateId: '22222222-2222-2222-2222-222222222222',
      eventType: 'thunder.test.v1',
      eventVersion: 1,
      payloadJson: { password: 'secret', ok: true },
      headers: { authorization: 'Bearer x' },
      lastError: 'boom',
      publishAttempts: 5,
      createdAt: new Date('2026-09-05T00:00:00.000Z'),
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payloadJson: scrubSecrets({ password: 'secret', ok: true }),
          headers: scrubSecrets({ authorization: 'Bearer x' }),
          publishAttempts: 5,
        }),
        select: { id: true },
      }),
    );

    const listed = await service.list({ limit: 10 });
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).not.toHaveProperty('payloadJson');
    expect(await service.count()).toBe(1);
  });
});

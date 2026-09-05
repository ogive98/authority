import { OutboxPublisherService } from '../events/outbox-publisher.service';
import { THUNDER_ERROR_CODES } from '../thunder.constants';
import { JobEnqueueService } from '../jobs/job-enqueue.service';
import { JobRegistryService } from '../jobs/job-registry.service';

/**
 * Chaos light (THU-HARD-06): Redis unavailable → degrade without corrupt paths.
 * Full kill-Redis e2e stays in ops runbook / manual drills.
 */
describe('thunder chaos light — Redis unavailable', () => {
  it('outbox publishDue returns 0 when Redis is down', async () => {
    const prisma = {
      $transaction: jest.fn(),
    };
    const redis = {
      createBullConnection: jest.fn().mockReturnValue(null),
    };
    const outboxDlq = { record: jest.fn() };

    const service = new OutboxPublisherService(
      prisma as never,
      redis as never,
      outboxDlq as never,
    );

    await expect(service.publishDue(10)).resolves.toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('job requeue fails closed with REDIS_UNAVAILABLE when Bull connection missing', async () => {
    const redis = {
      createBullConnection: jest.fn().mockReturnValue(null),
    };

    const service = new JobEnqueueService(
      { thunderJob: { findFirst: jest.fn(), create: jest.fn() } } as never,
      redis as never,
      new JobRegistryService(),
      { execute: jest.fn() } as never,
      { defaultPriority: jest.fn().mockReturnValue(2) } as never,
      {
        admitEnqueue: jest.fn(),
        tryAcquireInflightLock: jest.fn(),
        releaseInflightLock: jest.fn(),
      } as never,
      {
        getOrDefault: jest.fn().mockReturnValue({ planB: { maxAttempts: 3 } }),
      } as never,
    );

    await expect(
      service.requeueExisting({
        jobId: '11111111-1111-1111-1111-111111111111',
        jobType: 'thunder.hello.v1',
        queue: 'ops',
        priority: 2,
      }),
    ).rejects.toMatchObject({
      code: THUNDER_ERROR_CODES.REDIS_UNAVAILABLE,
    });
  });
});

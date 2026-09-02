import { HttpStatus } from '@nestjs/common';
import { JobEnqueueService } from './job-enqueue.service';
import { JobRegistryService } from './job-registry.service';
import { hashJobPayload } from './payload-hash';
import { THUNDER_ERROR_CODES, THUNDER_JOB_TYPES } from '../thunder.constants';
import { ThunderException } from '../thunder.exception';

describe('JobEnqueueService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  let prisma: {
    thunderJob: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let redis: { createBullConnection: jest.Mock };
  let registry: JobRegistryService;
  let service: JobEnqueueService;
  let queueAdd: jest.Mock;

  beforeEach(() => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'bull-1' });
    const queue = { add: queueAdd, close: jest.fn() };

    prisma = {
      thunderJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'job-1',
          status: 'PENDING',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    redis = {
      createBullConnection: jest.fn().mockReturnValue({}),
    };

    registry = new JobRegistryService();
    service = new JobEnqueueService(prisma as never, redis as never, registry);

    jest
      .spyOn(
        service as unknown as { getQueue: (family: string) => unknown },
        'getQueue',
      )
      .mockReturnValue(queue);
  });

  it('replays the same idempotency key without creating a new job', async () => {
    const payload = { message: 'hello' };
    prisma.thunderJob.findFirst.mockResolvedValue({
      id: 'existing-job',
      status: 'COMPLETED',
      payloadHash: hashJobPayload(payload),
    });

    const result = await service.enqueue({
      jobType: THUNDER_JOB_TYPES.hello,
      companyId,
      queue: 'ops',
      idempotencyKey: 'key-1',
      payload,
    });

    expect(result).toEqual({
      jobId: 'existing-job',
      status: 'COMPLETED',
      replayed: true,
    });
    expect(prisma.thunderJob.create).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key with a different payload', async () => {
    prisma.thunderJob.findFirst.mockResolvedValue({
      id: 'existing-job',
      status: 'COMPLETED',
      payloadHash: 'different-hash',
    });

    await expect(
      service.enqueue({
        jobType: THUNDER_JOB_TYPES.hello,
        companyId,
        queue: 'ops',
        idempotencyKey: 'key-1',
        payload: { message: 'hello' },
      }),
    ).rejects.toMatchObject({
      code: THUNDER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    });
  });
});

describe('JobEnqueueService idempotency conflict status', () => {
  it('uses HTTP 409 for payload conflicts', async () => {
    const companyId = '11111111-1111-1111-1111-111111111111';
    const prisma = {
      thunderJob: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'existing-job',
          status: 'COMPLETED',
          payloadHash: 'other',
        }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const redis = { createBullConnection: jest.fn() };
    const service = new JobEnqueueService(
      prisma as never,
      redis as never,
      new JobRegistryService(),
    );

    try {
      await service.enqueue({
        jobType: THUNDER_JOB_TYPES.hello,
        companyId,
        queue: 'ops',
        idempotencyKey: 'key-1',
        payload: { message: 'hello' },
      });
      throw new Error('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ThunderException);
      expect((error as ThunderException).getStatus()).toBe(HttpStatus.CONFLICT);
      expect((error as ThunderException).code).toBe(
        THUNDER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
      );
    }
  });
});

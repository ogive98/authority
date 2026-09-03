import { HttpStatus } from '@nestjs/common';
import { JobEnqueueService } from './job-enqueue.service';
import { JobRegistryService } from './job-registry.service';
import { hashJobPayload } from './payload-hash';
import { THUNDER_ERROR_CODES, THUNDER_JOB_TYPES } from '../thunder.constants';
import { ThunderException } from '../thunder.exception';
import { defaultPlanAbcPolicy } from '../resilience/plan-abc/plan-abc.types';

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
  let planCRegistry: { execute: jest.Mock };
  let resources: { defaultPriority: jest.Mock };
  let admission: {
    admitEnqueue: jest.Mock;
    tryAcquireInflightLock: jest.Mock;
    releaseInflightLock: jest.Mock;
  };
  let policies: { getOrDefault: jest.Mock };
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

    planCRegistry = {
      execute: jest.fn().mockResolvedValue({
        mode: 'plan_c',
        dependencyKey: 'external_api_stub',
      }),
    };

    resources = {
      defaultPriority: jest.fn().mockReturnValue(2),
    };

    admission = {
      admitEnqueue: jest.fn().mockResolvedValue({
        allowed: true,
        policy: defaultPlanAbcPolicy(THUNDER_JOB_TYPES.hello),
        correlationId: 'corr-1',
      }),
      tryAcquireInflightLock: jest
        .fn()
        .mockResolvedValue({ acquired: true, key: 'lock-1' }),
      releaseInflightLock: jest.fn().mockResolvedValue(undefined),
    };

    policies = {
      getOrDefault: jest
        .fn()
        .mockImplementation((jobType: string) => defaultPlanAbcPolicy(jobType)),
    };

    registry = new JobRegistryService();
    service = new JobEnqueueService(
      prisma as never,
      redis as never,
      registry,
      planCRegistry as never,
      resources as never,
      admission as never,
      policies as never,
    );

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

  it('returns Plan C without enqueueing when admission returns plan_c', async () => {
    admission.admitEnqueue.mockResolvedValue({
      allowed: false,
      kind: 'plan_c',
      policy: defaultPlanAbcPolicy(THUNDER_JOB_TYPES.breakerGuarded),
      dependencyKey: 'external_api_stub',
      correlationId: 'corr-pc',
    });

    const result = await service.enqueue({
      jobType: THUNDER_JOB_TYPES.breakerGuarded,
      companyId,
      queue: 'ops',
      idempotencyKey: 'breaker-open',
      payload: {},
    });

    expect(result).toMatchObject({
      status: 'PLAN_C',
      replayed: false,
      planC: true,
      dependencyKey: 'external_api_stub',
    });
    expect(prisma.thunderJob.create).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
    expect(planCRegistry.execute).toHaveBeenCalled();
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

  it('rejects enqueue when admission rejects module disabled', async () => {
    admission.admitEnqueue.mockResolvedValue({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.MODULE_DISABLED,
      message: 'Module disabled: inventory',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      correlationId: 'corr-mod',
    });

    await expect(
      service.enqueue({
        jobType: THUNDER_JOB_TYPES.moduleGated,
        companyId,
        queue: 'ops',
        idempotencyKey: 'mod-off',
        payload: {},
      }),
    ).rejects.toMatchObject({
      code: THUNDER_ERROR_CODES.MODULE_DISABLED,
    });
    expect(prisma.thunderJob.create).not.toHaveBeenCalled();
  });

  it('rejects sheddable enqueue when admission returns shed', async () => {
    admission.admitEnqueue.mockResolvedValue({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.SHED_P4,
      message: 'shed_p4',
      status: HttpStatus.SERVICE_UNAVAILABLE,
      correlationId: 'corr-shed',
    });

    await expect(
      service.enqueue({
        jobType: THUNDER_JOB_TYPES.importBulk,
        companyId,
        queue: 'import',
        idempotencyKey: 'import-shed',
        payload: {},
      }),
    ).rejects.toMatchObject({
      code: THUNDER_ERROR_CODES.SHED_P4,
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
    const planCRegistry = { execute: jest.fn() };
    const resources = { defaultPriority: jest.fn().mockReturnValue(2) };
    const admission = {
      admitEnqueue: jest.fn().mockResolvedValue({
        allowed: true,
        policy: defaultPlanAbcPolicy(THUNDER_JOB_TYPES.hello),
        correlationId: 'corr-1',
      }),
      tryAcquireInflightLock: jest.fn().mockResolvedValue({ acquired: true }),
      releaseInflightLock: jest.fn(),
    };
    const policies = {
      getOrDefault: jest
        .fn()
        .mockImplementation((jobType: string) => defaultPlanAbcPolicy(jobType)),
    };
    const service = new JobEnqueueService(
      prisma as never,
      redis as never,
      new JobRegistryService(),
      planCRegistry as never,
      resources as never,
      admission as never,
      policies as never,
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

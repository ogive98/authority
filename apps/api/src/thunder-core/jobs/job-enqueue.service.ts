import {
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import {
  assertJsonPayloadSize,
  PayloadTooLargeError,
} from '../../common/json-safety';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdmissionOrchestratorService } from '../admission/admission-orchestrator.service';
import { createThunderContext } from '../context/thunder-context';
import { ResourceManagerService } from '../resources/resource-manager.service';
import { PlanAbcPolicyService } from '../resilience/plan-abc/plan-abc-policy.service';
import { PlanCRegistryService } from '../resilience/plan-c-registry.service';
import {
  THUNDER_ERROR_CODES,
  THUNDER_JOB_TYPES,
  thunderQueueName,
  thunderWorkersEnabled,
  type ThunderQueueFamily,
} from '../thunder.constants';
import { ThunderException } from '../thunder.exception';
import type { JobEnqueueResult } from './job.types';
import { JobRegistryService } from './job-registry.service';
import { hashJobPayload } from './payload-hash';
import { DEFAULT_MAX_ATTEMPTS } from './retry/retry-policy';
import { withThunderSpan } from '../observability/tracing';

export interface EnqueueJobInput {
  jobType: string;
  companyId: string;
  queue: ThunderQueueFamily;
  priority?: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  userId?: string;
  correlationId?: string;
}

@Injectable()
export class JobEnqueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queues = new Map<ThunderQueueFamily, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: JobRegistryService,
    private readonly planCRegistry: PlanCRegistryService,
    private readonly resources: ResourceManagerService,
    private readonly admission: AdmissionOrchestratorService,
    private readonly policies: PlanAbcPolicyService,
  ) {}

  async enqueueHello(params: {
    companyId: string;
    userId?: string;
    idempotencyKey: string;
    message?: string;
    correlationId?: string;
  }): Promise<JobEnqueueResult> {
    return this.enqueue({
      jobType: THUNDER_JOB_TYPES.hello,
      companyId: params.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: params.idempotencyKey,
      payload: {
        message: params.message ?? 'hello',
      },
      userId: params.userId,
      correlationId: params.correlationId,
    });
  }

  async enqueueFailRetryable(params: {
    companyId: string;
    userId?: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<JobEnqueueResult> {
    return this.enqueue({
      jobType: THUNDER_JOB_TYPES.failRetryable,
      companyId: params.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: params.idempotencyKey,
      payload: {},
      userId: params.userId,
      correlationId: params.correlationId,
    });
  }

  async enqueueBreakerGuarded(params: {
    companyId: string;
    userId?: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<JobEnqueueResult> {
    return this.enqueue({
      jobType: THUNDER_JOB_TYPES.breakerGuarded,
      companyId: params.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: params.idempotencyKey,
      payload: {},
      userId: params.userId,
      correlationId: params.correlationId,
    });
  }

  async enqueueFailFatal(params: {
    companyId: string;
    userId?: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<JobEnqueueResult> {
    return this.enqueue({
      jobType: THUNDER_JOB_TYPES.failFatal,
      companyId: params.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: params.idempotencyKey,
      payload: {},
      userId: params.userId,
      correlationId: params.correlationId,
    });
  }

  async enqueueFailTimeout(params: {
    companyId: string;
    userId?: string;
    idempotencyKey: string;
    correlationId?: string;
  }): Promise<JobEnqueueResult> {
    return this.enqueue({
      jobType: THUNDER_JOB_TYPES.failTimeout,
      companyId: params.companyId,
      queue: 'ops',
      priority: 2,
      idempotencyKey: params.idempotencyKey,
      payload: {},
      userId: params.userId,
      correlationId: params.correlationId,
    });
  }

  async reconcileOrphanedPendingJobs(limit = 20): Promise<number> {
    if (!this.redis.isConfigured()) {
      return 0;
    }

    const rows = await this.prisma.thunderJob.findMany({
      where: {
        status: 'PENDING',
        bullJobId: null,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    let reconciled = 0;
    for (const row of rows) {
      const queueFamily = row.queue as ThunderQueueFamily;
      if (!this.registry.get(row.jobType)) {
        continue;
      }

      try {
        await this.addJobToQueue({
          jobId: row.id,
          jobType: row.jobType,
          queue: queueFamily,
          priority: row.priority,
        });
        reconciled += 1;
      } catch {
        // leave row pending for a later reconciliation pass
      }
    }

    return reconciled;
  }

  async requeueExisting(params: {
    jobId: string;
    jobType: string;
    queue: ThunderQueueFamily;
    priority: number;
  }): Promise<void> {
    await this.addJobToQueue(params);
  }

  onModuleInit(): void {
    if (!thunderWorkersEnabled()) {
      return;
    }
    void this.reconcileOrphanedPendingJobs();
  }

  async enqueue(input: EnqueueJobInput): Promise<JobEnqueueResult> {
    return withThunderSpan(
      'thunder.job.enqueue',
      {
        'thunder.job_type': input.jobType,
        'thunder.queue': input.queue,
        'thunder.company_id': input.companyId,
      },
      async (span) => {
        const result = await this.enqueueInner(input);
        if ('jobId' in result && result.jobId) {
          span.setAttribute('thunder.job_id', result.jobId);
        }
        span.setAttribute('thunder.enqueue_status', result.status);
        span.setAttribute('thunder.replayed', result.replayed ?? false);
        return result;
      },
    );
  }

  private async enqueueInner(input: EnqueueJobInput): Promise<JobEnqueueResult> {
    const registration = this.registry.get(input.jobType);
    if (!registration) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.UNKNOWN_JOB_TYPE,
        `Unknown job type: ${input.jobType}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      assertJsonPayloadSize(input.payload);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        throw new ThunderException(
          THUNDER_ERROR_CODES.PAYLOAD_TOO_LARGE,
          error.message,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      throw error;
    }

    const decision = await this.admission.admitEnqueue({
      jobType: input.jobType,
      companyId: input.companyId,
      queue: input.queue,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      registryModuleKey: registration.moduleKey,
      registryDependencyKey: registration.dependencyKey,
    });

    if (!decision.allowed) {
      if (decision.kind === 'plan_c') {
        const planCResult = await this.planCRegistry.execute(
          decision.dependencyKey,
          {
            dependencyKey: decision.dependencyKey,
            jobType: input.jobType,
            companyId: input.companyId,
            correlationId: decision.correlationId,
          },
        );

        return {
          status: 'PLAN_C',
          replayed: false,
          planC: true,
          dependencyKey: decision.dependencyKey,
          planCResult: planCResult as Prisma.InputJsonValue,
        };
      }

      throw new ThunderException(
        decision.code,
        decision.message,
        decision.status,
      );
    }

    const payloadHash = hashJobPayload(input.payload);
    const existing = await this.prisma.thunderJob.findFirst({
      where: {
        companyId: input.companyId,
        idempotencyKey: input.idempotencyKey,
      },
    });

    if (existing) {
      if (existing.payloadHash && existing.payloadHash !== payloadHash) {
        throw new ThunderException(
          THUNDER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
          'Idempotency key already used with a different payload',
          HttpStatus.CONFLICT,
        );
      }

      return {
        jobId: existing.id,
        status: existing.status,
        replayed: true,
      };
    }

    const lock = await this.admission.tryAcquireInflightLock(
      input.companyId,
      input.idempotencyKey,
      decision.correlationId,
    );
    if (!lock.acquired) {
      const raced = await this.prisma.thunderJob.findFirst({
        where: {
          companyId: input.companyId,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (raced) {
        return {
          jobId: raced.id,
          status: raced.status,
          replayed: true,
        };
      }
      throw new ThunderException(
        THUNDER_ERROR_CODES.IN_FLIGHT_LOCK,
        'Duplicate in-flight enqueue for idempotency key',
        HttpStatus.CONFLICT,
      );
    }

    const context = createThunderContext({
      source: 'http',
      companyId: input.companyId,
      userId: input.userId,
      correlationId: decision.correlationId,
      idempotencyKey: input.idempotencyKey,
    });

    const priority =
      input.priority ?? this.resources.defaultPriority(input.queue);

    let jobRow: { id: string; status: string };

    try {
      jobRow = await this.prisma.thunderJob.create({
        data: {
          companyId: input.companyId,
          jobType: input.jobType,
          queue: input.queue,
          priority,
          idempotencyKey: input.idempotencyKey,
          payloadHash,
          payloadJson: {
            ...input.payload,
            _context: context,
          } as unknown as Prisma.InputJsonValue,
          status: 'PENDING',
        },
        select: { id: true, status: true },
      });
    } catch (error) {
      await this.admission.releaseInflightLock(lock.key);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.thunderJob.findFirst({
          where: {
            companyId: input.companyId,
            idempotencyKey: input.idempotencyKey,
          },
        });
        if (!raced) {
          throw error;
        }
        if (raced.payloadHash && raced.payloadHash !== payloadHash) {
          throw new ThunderException(
            THUNDER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
            'Idempotency key already used with a different payload',
            HttpStatus.CONFLICT,
          );
        }
        return {
          jobId: raced.id,
          status: raced.status,
          replayed: true,
        };
      }
      throw error;
    }

    try {
      await this.addJobToQueue({
        jobId: jobRow.id,
        jobType: input.jobType,
        queue: input.queue,
        priority,
        maxAttempts: decision.policy.planB.maxAttempts,
      });
    } catch (error) {
      await this.admission.releaseInflightLock(lock.key);
      const message =
        error instanceof Error ? error.message : 'Failed to enqueue BullMQ job';
      await this.prisma.thunderJob.update({
        where: { id: jobRow.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorJson: { message, phase: 'enqueue' },
        },
      });
      throw new ThunderException(
        THUNDER_ERROR_CODES.REDIS_UNAVAILABLE,
        message,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    await this.admission.releaseInflightLock(lock.key);

    return {
      jobId: jobRow.id,
      status: jobRow.status,
      replayed: false,
    };
  }

  private async addJobToQueue(params: {
    jobId: string;
    jobType: string;
    queue: ThunderQueueFamily;
    priority: number;
    maxAttempts?: number;
  }): Promise<void> {
    const queue = this.getQueue(params.queue);
    const attempts =
      params.maxAttempts ??
      this.policies.getOrDefault(params.jobType).planB.maxAttempts ??
      DEFAULT_MAX_ATTEMPTS;
    const bullJob = await queue.add(
      params.jobType,
      { jobId: params.jobId },
      {
        jobId: params.jobId,
        priority: params.priority,
        attempts,
        backoff: { type: 'custom' },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    await this.prisma.thunderJob.update({
      where: { id: params.jobId },
      data: { bullJobId: bullJob.id },
    });
  }

  private getQueue(family: ThunderQueueFamily): Queue {
    const existing = this.queues.get(family);
    if (existing) {
      return existing;
    }

    const connection = this.requireBullConnection();
    const queue = new Queue(thunderQueueName(family), { connection });
    this.queues.set(family, queue);
    return queue;
  }

  private requireBullConnection(): Redis {
    const connection = this.redis.createBullConnection();
    if (!connection) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.REDIS_UNAVAILABLE,
        'Redis is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return connection;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.queues.clear();
  }
}

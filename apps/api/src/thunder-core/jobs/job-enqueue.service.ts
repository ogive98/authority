import { HttpStatus, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createThunderContext } from '../context/thunder-context';
import {
  THUNDER_ERROR_CODES,
  THUNDER_JOB_TYPES,
  thunderQueueName,
  type ThunderQueueFamily,
} from '../thunder.constants';
import { ThunderException } from '../thunder.exception';
import type { JobEnqueueResult } from './job.types';
import { JobRegistryService } from './job-registry.service';
import { hashJobPayload } from './payload-hash';
import { getJobAttemptsForType } from './retry/retry-policy';

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
export class JobEnqueueService implements OnModuleDestroy {
  private readonly queues = new Map<ThunderQueueFamily, Queue>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: JobRegistryService,
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

  async enqueue(input: EnqueueJobInput): Promise<JobEnqueueResult> {
    const registration = this.registry.get(input.jobType);
    if (!registration) {
      throw new ThunderException(
        THUNDER_ERROR_CODES.UNKNOWN_JOB_TYPE,
        `Unknown job type: ${input.jobType}`,
        HttpStatus.BAD_REQUEST,
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

    const context = createThunderContext({
      source: 'http',
      companyId: input.companyId,
      userId: input.userId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
    });

    let jobRow: { id: string; status: string };

    try {
      jobRow = await this.prisma.thunderJob.create({
        data: {
          companyId: input.companyId,
          jobType: input.jobType,
          queue: input.queue,
          priority: input.priority ?? 2,
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

    const queue = this.getQueue(input.queue);
    const attempts = getJobAttemptsForType(input.jobType);
    const bullJob = await queue.add(
      input.jobType,
      { jobId: jobRow.id },
      {
        jobId: jobRow.id,
        priority: input.priority ?? 2,
        attempts,
        backoff: { type: 'custom' },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    await this.prisma.thunderJob.update({
      where: { id: jobRow.id },
      data: { bullJobId: bullJob.id },
    });

    return {
      jobId: jobRow.id,
      status: jobRow.status,
      replayed: false,
    };
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

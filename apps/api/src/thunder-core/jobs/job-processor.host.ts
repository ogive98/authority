import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { ModuleRegistryService } from '../../modules-registry/module-registry.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ThunderContext } from '../context/thunder-context';
import { ResourceManagerService } from '../resources/resource-manager.service';
import { PlanAbcPolicyService } from '../resilience/plan-abc/plan-abc-policy.service';
import {
  thunderQueueName,
  thunderWorkersEnabled,
  type ThunderQueueFamily,
} from '../thunder.constants';
import { SHEDDABLE_QUEUES } from '../resources/resource-manager.types';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { DlqService } from './dlq/dlq.service';
import type { ThunderQueueJobData } from './job.types';
import { JobRegistryService } from './job-registry.service';
import { isRetryableJobError } from './retry/job-errors';
import {
  computeBackoffDelayMs,
  DEFAULT_MAX_ATTEMPTS,
} from './retry/retry-policy';
import { ThunderMetricsService } from '../observability/thunder-metrics.service';
import { withThunderSpan } from '../observability/tracing';

@Injectable()
export class JobProcessorHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobProcessorHost.name);
  private readonly lanes = new Map<
    ThunderQueueFamily,
    Worker<ThunderQueueJobData>
  >();
  private workerConnections: Redis[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: JobRegistryService,
    private readonly dlqService: DlqService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly modules: ModuleRegistryService,
    private readonly resources: ResourceManagerService,
    private readonly policies: PlanAbcPolicyService,
    private readonly metrics: ThunderMetricsService,
  ) {}

  onModuleInit(): void {
    if (!thunderWorkersEnabled()) {
      return;
    }

    for (const queueFamily of this.registry.getQueuesInUse()) {
      const target = this.resources.getConcurrency(queueFamily);
      const connection = this.redis.createBullConnection();
      if (!connection) {
        this.logger.warn('Thunder workers skipped — Redis unavailable');
        return;
      }
      this.workerConnections.push(connection);

      const worker = new Worker<ThunderQueueJobData>(
        thunderQueueName(queueFamily),
        async (job) => this.processJob(job),
        {
          connection,
          concurrency: Math.max(1, target),
          settings: {
            backoffStrategy: (attemptsMade) =>
              computeBackoffDelayMs(attemptsMade),
          },
        },
      );

      worker.on('failed', (job, error) => {
        void this.handleFinalFailure(job, error);
      });

      this.lanes.set(queueFamily, worker);
      if (target <= 0) {
        void worker.pause();
        this.logger.log(`Thunder lane ${queueFamily} started paused (shed P4)`);
      } else {
        this.logger.log(
          `Thunder worker listening on ${queueFamily} (concurrency=${target})`,
        );
      }
    }
  }

  /** Pause/resume sheddable lanes from live pressure. Never touches critical. */
  async syncSheddableLanes(): Promise<void> {
    for (const family of SHEDDABLE_QUEUES) {
      const worker = this.lanes.get(family);
      if (!worker) continue;
      const pause = this.resources.getConcurrency(family) <= 0;
      try {
        if (pause && !worker.isPaused()) {
          await worker.pause();
          this.logger.log(`Thunder lane paused ${family} (shed P4)`);
        } else if (!pause && worker.isPaused()) {
          await worker.resume();
          this.logger.log(`Thunder lane resumed ${family}`);
        }
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? error.message
            : `Lane sync failed for ${family}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.lanes.values()].map((worker) => worker.close(true)),
    );
    this.lanes.clear();

    for (const connection of this.workerConnections) {
      try {
        connection.disconnect();
      } catch {
        // ignore shutdown races in tests
      }
    }
    this.workerConnections = [];
  }

  async processJob(job: Job<ThunderQueueJobData>): Promise<void> {
    const jobId = job.data.jobId;
    return withThunderSpan(
      'thunder.job.process',
      {
        'thunder.job_id': jobId,
      },
      async (span) => {
        await this.processJobInner(job, span);
      },
    );
  }

  private async processJobInner(
    job: Job<ThunderQueueJobData>,
    span: { setAttribute: (key: string, value: string | number | boolean) => void },
  ): Promise<void> {
    const jobId = job.data.jobId;
    const row = await this.prisma.thunderJob.findUnique({
      where: { id: jobId },
    });

    if (!row) {
      this.logger.warn(`Thunder job row missing: ${jobId}`);
      return;
    }

    span.setAttribute('thunder.job_type', row.jobType);
    span.setAttribute('thunder.queue', row.queue);
    if (row.companyId) {
      span.setAttribute('thunder.company_id', row.companyId);
    }

    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
      return;
    }

    const registration = this.registry.get(row.jobType);
    if (!registration) {
      await this.markFailed(row.id, `Unknown job type: ${row.jobType}`);
      return;
    }

    if (registration.moduleKey && row.companyId) {
      const enabled = await this.modules.isEnabled(
        row.companyId,
        registration.moduleKey,
      );
      if (!enabled) {
        await this.prisma.thunderJob.update({
          where: { id: row.id },
          data: {
            status: 'PAUSED_BY_MODULE',
            bullJobId: null,
            errorJson: {
              message: `Module disabled: ${registration.moduleKey}`,
              phase: 'processor',
              moduleKey: registration.moduleKey,
            },
          },
        });
        return;
      }
    }

    const payload = (row.payloadJson ?? {}) as Prisma.JsonObject;
    const context = this.readContext(payload);
    const timeoutMs = this.policies.getOrDefault(row.jobType).timeoutMs;
    const now = new Date();

    await this.prisma.thunderJob.update({
      where: { id: row.id },
      data: {
        status: 'RUNNING',
        startedAt: row.startedAt ?? now,
        heartbeatAt: now,
        attempts: { increment: 1 },
      },
    });

    const dependencyKey = registration.dependencyKey;
    const started = process.hrtime.bigint();

    try {
      const result = await this.runWithTimeout(
        registration.handler({
          jobId: row.id,
          jobType: row.jobType,
          companyId: row.companyId ?? undefined,
          payload,
          context,
          attempt: job.attemptsMade + 1,
        }),
        timeoutMs,
      );

      if (dependencyKey) {
        await this.circuitBreaker.recordSuccess(dependencyKey);
      }

      await this.prisma.thunderJob.update({
        where: { id: row.id },
        data: {
          status: 'COMPLETED',
          resultJson: result,
          finishedAt: new Date(),
          heartbeatAt: new Date(),
          errorJson: Prisma.DbNull,
        },
      });

      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      this.metrics.observeJobDuration({
        jobType: row.jobType,
        queue: row.queue,
        status: 'success',
        seconds,
      });
      this.metrics.recordJobSuccess(row.jobType, row.queue);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Thunder job failed';
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;

      if (dependencyKey) {
        await this.circuitBreaker.recordFailure(dependencyKey);
      }

      await this.prisma.thunderJob.update({
        where: { id: row.id },
        data: {
          errorJson: {
            message,
            attempt: job.attemptsMade + 1,
          },
        },
      });

      if (!isRetryableJobError(error)) {
        this.metrics.observeJobDuration({
          jobType: row.jobType,
          queue: row.queue,
          status: 'fail',
          seconds,
        });
        throw new UnrecoverableError(message);
      }

      this.metrics.observeJobDuration({
        jobType: row.jobType,
        queue: row.queue,
        status: 'retry',
        seconds,
      });
      this.metrics.recordJobRetry(row.jobType, row.queue);
      throw error;
    }
  }

  private async handleFinalFailure(
    job: Job<ThunderQueueJobData> | undefined,
    error: Error,
  ): Promise<void> {
    try {
      if (!job) {
        return;
      }

      const maxAttempts = job.opts.attempts ?? DEFAULT_MAX_ATTEMPTS;
      const isFinal =
        error instanceof UnrecoverableError || job.attemptsMade >= maxAttempts;

      if (!isFinal) {
        return;
      }

      const row = await this.prisma.thunderJob.findUnique({
        where: { id: job.data.jobId },
      });
      if (!row) {
        return;
      }

      const existing = await this.prisma.thunderDlqEntry.findFirst({
        where: { jobId: row.id },
      });
      if (existing) {
        return;
      }

      await this.dlqService.record({
        jobId: row.id,
        companyId: row.companyId ?? undefined,
        jobType: row.jobType,
        queue: row.queue,
        payloadJson: row.payloadJson ?? {},
        lastError: error.message,
        attempts: row.attempts,
      });

      await this.markFailed(row.id, error.message);
      this.metrics.recordJobFail(row.jobType, row.queue);
    } catch (handlerError) {
      this.logger.warn(
        handlerError instanceof Error
          ? handlerError.message
          : 'Thunder DLQ handler failed',
      );
    }
  }

  private async runWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            const timeoutError = new Error(
              `Job attempt timed out after ${timeoutMs}ms`,
            );
            timeoutError.name = 'TimeoutError';
            reject(timeoutError);
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private readContext(payload: Prisma.JsonObject): ThunderContext {
    const raw = payload._context;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as unknown as ThunderContext;
    }

    return {
      correlationId: 'missing',
      requestId: 'missing',
      source: 'system',
      occurredAt: new Date().toISOString(),
    };
  }

  private async markFailed(jobId: string, message: string): Promise<void> {
    await this.prisma.thunderJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorJson: { message },
      },
    });
  }

  /** Test helper — process one queued job without BullMQ worker. */
  async processById(jobId: string): Promise<void> {
    const row = await this.prisma.thunderJob.findUnique({
      where: { id: jobId },
    });
    if (!row) {
      throw new Error(`Job not found: ${jobId}`);
    }

    await this.processJob({
      id: row.bullJobId ?? row.id,
      data: { jobId: row.id },
      attemptsMade: row.attempts,
      opts: { attempts: DEFAULT_MAX_ATTEMPTS },
    } as Job<ThunderQueueJobData>);
  }
}

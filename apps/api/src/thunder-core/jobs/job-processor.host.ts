import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ThunderContext } from '../context/thunder-context';
import { thunderQueueName, thunderWorkersEnabled } from '../thunder.constants';
import type { ThunderQueueJobData } from './job.types';
import { JobRegistryService } from './job-registry.service';

@Injectable()
export class JobProcessorHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobProcessorHost.name);
  private readonly workers: Worker<ThunderQueueJobData>[] = [];
  private workerConnections: Redis[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly registry: JobRegistryService,
  ) {}

  onModuleInit(): void {
    if (!thunderWorkersEnabled()) {
      return;
    }

    for (const queueFamily of this.registry.getQueuesInUse()) {
      const connection = this.redis.createBullConnection();
      if (!connection) {
        this.logger.warn('Thunder workers skipped — Redis unavailable');
        return;
      }
      this.workerConnections.push(connection);

      const worker = new Worker<ThunderQueueJobData>(
        thunderQueueName(queueFamily),
        async (job) => this.processJob(job),
        { connection, concurrency: 2 },
      );

      worker.on('failed', (job, error) => {
        this.logger.warn(
          `Job ${job?.id ?? 'unknown'} failed: ${error.message}`,
        );
      });

      this.workers.push(worker);
      this.logger.log(`Thunder worker listening on ${queueFamily}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers.length = 0;

    for (const connection of this.workerConnections) {
      await connection.quit();
    }
    this.workerConnections = [];
  }

  async processJob(job: Job<ThunderQueueJobData>): Promise<void> {
    const jobId = job.data.jobId;
    const row = await this.prisma.thunderJob.findUnique({
      where: { id: jobId },
    });

    if (!row) {
      this.logger.warn(`Thunder job row missing: ${jobId}`);
      return;
    }

    if (row.status === 'COMPLETED' || row.status === 'CANCELLED') {
      return;
    }

    const registration = this.registry.get(row.jobType);
    if (!registration) {
      await this.markFailed(row.id, `Unknown job type: ${row.jobType}`);
      return;
    }

    const payload = (row.payloadJson ?? {}) as Prisma.JsonObject;
    const context = this.readContext(payload);

    await this.prisma.thunderJob.update({
      where: { id: row.id },
      data: {
        status: 'RUNNING',
        startedAt: row.startedAt ?? new Date(),
        attempts: { increment: 1 },
      },
    });

    try {
      const result = await registration.handler({
        jobId: row.id,
        jobType: row.jobType,
        companyId: row.companyId ?? undefined,
        payload,
        context,
        attempt: job.attemptsMade + 1,
      });

      await this.prisma.thunderJob.update({
        where: { id: row.id },
        data: {
          status: 'COMPLETED',
          resultJson: result,
          finishedAt: new Date(),
          errorJson: Prisma.DbNull,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Thunder job failed';
      await this.markFailed(row.id, message);
      throw error;
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
    } as Job<ThunderQueueJobData>);
  }
}

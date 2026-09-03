import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JobEnqueueService } from '../jobs/job-enqueue.service';
import { DlqService } from '../jobs/dlq/dlq.service';
import type { ThunderQueueFamily } from '../thunder.constants';
import { ResourceManagerService } from './resource-manager.service';

@Injectable()
export class WatchdogService {
  private readonly logger = new Logger(WatchdogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resources: ResourceManagerService,
    private readonly enqueue: JobEnqueueService,
    private readonly dlq: DlqService,
  ) {}

  async scanOnce(limit = 50): Promise<number> {
    const stallMs = this.resources.getStallThresholdMs();
    const cutoff = new Date(Date.now() - stallMs);

    const stalled = await this.prisma.thunderJob.findMany({
      where: {
        status: 'RUNNING',
        OR: [
          { heartbeatAt: { lt: cutoff } },
          { heartbeatAt: null, startedAt: { lt: cutoff } },
        ],
      },
      orderBy: { startedAt: 'asc' },
      take: limit,
    });

    let handled = 0;
    for (const row of stalled) {
      try {
        await this.handleStalled(row);
        handled += 1;
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? error.message
            : `Watchdog failed for job ${row.id}`,
        );
      }
    }

    return handled;
  }

  private async handleStalled(row: {
    id: string;
    companyId: string | null;
    jobType: string;
    queue: string;
    priority: number;
    idempotencyKey: string | null;
    payloadJson: Prisma.JsonValue | null;
    attempts: number;
  }): Promise<void> {
    if (row.idempotencyKey) {
      await this.prisma.thunderJob.update({
        where: { id: row.id },
        data: {
          status: 'PENDING',
          bullJobId: null,
          heartbeatAt: null,
          errorJson: {
            message: 'Stalled job requeued by watchdog',
            phase: 'watchdog',
          },
        },
      });

      await this.enqueue.requeueExisting({
        jobId: row.id,
        jobType: row.jobType,
        queue: row.queue as ThunderQueueFamily,
        priority: row.priority,
      });
      return;
    }

    await this.dlq.record({
      jobId: row.id,
      companyId: row.companyId ?? undefined,
      jobType: row.jobType,
      queue: row.queue,
      payloadJson: row.payloadJson ?? {},
      lastError: 'Stalled job without idempotency key',
      attempts: row.attempts,
    });

    await this.prisma.thunderJob.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        errorJson: {
          message: 'Stalled job without idempotency key',
          phase: 'watchdog',
        },
      },
    });
  }
}

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { JobEnqueueService } from '../thunder-core/jobs/job-enqueue.service';
import { thunderWorkersEnabled } from '../thunder-core/thunder.constants';
import { PrismaService } from '../prisma/prisma.service';
import { BackupRetentionService } from './backup-retention.service';
import { BACKUP_JOB_TYPES } from './backup.constants';

function tunisClock(now = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
  };
}

/**
 * D306 — tick every minute; at configured Tunis hour enqueue Thunder retention
 * job (HOW). Falls back to direct domain run when workers/Redis are off.
 */
@Injectable()
export class BackupRetentionScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BackupRetentionScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly lastRunByCompany = new Map<string, string>();
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly retention: BackupRetentionService,
    @Optional() private readonly jobs?: JobEnqueueService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    setTimeout(() => void this.tick(), 8_000);
    this.logger.log(
      'Backup retention scheduler armed (Africa/Tunis, default hour=3)',
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Test/helper entry — process one schedule tick. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const clock = tunisClock();
      const states = await this.prisma.modModuleState.findMany({
        where: { moduleKey: 'backup', status: ModModuleStatus.ENABLED },
        select: { companyId: true },
      });
      for (const state of states) {
        const scheduleOn = await this.retention.isScheduleEnabled(
          state.companyId,
        );
        if (!scheduleOn) continue;
        const hour = await this.retention.resolveScheduleHour(state.companyId);
        const last = this.lastRunByCompany.get(state.companyId) ?? null;
        if (clock.hour !== hour || last === clock.date) continue;

        try {
          await this.dispatch(state.companyId, clock.date);
          this.lastRunByCompany.set(state.companyId, clock.date);
        } catch (err) {
          this.logger.warn(
            `retention schedule failed company=${state.companyId}: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private async dispatch(companyId: string, date: string): Promise<void> {
    const idempotencyKey = `backup.retention:${companyId}:${date}`;
    if (this.jobs && thunderWorkersEnabled()) {
      await this.jobs.enqueue({
        jobType: BACKUP_JOB_TYPES.retentionRun,
        companyId,
        queue: 'ops',
        priority: 3,
        idempotencyKey,
        payload: { force: false, source: 'schedule' },
      });
      this.logger.log(
        `retention enqueued company=${companyId} key=${idempotencyKey}`,
      );
      return;
    }
    const result = await this.retention.runRetention(companyId);
    this.logger.log(
      `retention direct company=${companyId} deleted=${result.softDeleted}`,
    );
  }
}

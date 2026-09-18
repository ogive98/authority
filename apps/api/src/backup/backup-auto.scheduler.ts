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
import { BackupAutoService } from './backup-auto.service';
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
 * D308 — tick every minute; at configured Tunis hour enqueue Thunder
 * auto-backup job (HOW). Falls back to direct domain create when workers off.
 */
@Injectable()
export class BackupAutoScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupAutoScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly lastRunByCompany = new Map<string, string>();
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auto: BackupAutoService,
    @Optional() private readonly jobs?: JobEnqueueService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    setTimeout(() => void this.tick(), 12_000);
    this.logger.log(
      'Backup auto-create scheduler armed (Africa/Tunis, default hour=2)',
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
        const scheduleOn = await this.auto.isAutoBackupEnabled(state.companyId);
        if (!scheduleOn) continue;
        const hour = await this.auto.resolveAutoHour(state.companyId);
        const last = this.lastRunByCompany.get(state.companyId) ?? null;
        if (clock.hour !== hour || last === clock.date) continue;

        try {
          await this.dispatch(state.companyId, clock.date);
          this.lastRunByCompany.set(state.companyId, clock.date);
        } catch (err) {
          this.logger.warn(
            `auto-backup schedule failed company=${state.companyId}: ${
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
    const idempotencyKey = `backup.auto:${companyId}:${date}`;
    if (this.jobs && thunderWorkersEnabled()) {
      await this.jobs.enqueue({
        jobType: BACKUP_JOB_TYPES.autoBackupCreate,
        companyId,
        queue: 'ops',
        priority: 4,
        idempotencyKey,
        payload: { source: 'schedule' },
      });
      this.logger.log(
        `auto-backup enqueued company=${companyId} key=${idempotencyKey}`,
      );
      return;
    }
    const result = await this.auto.runScheduledCreate(companyId);
    this.logger.log(
      `auto-backup direct company=${companyId} backupId=${result.backupId} scope=${result.scope}`,
    );
  }
}

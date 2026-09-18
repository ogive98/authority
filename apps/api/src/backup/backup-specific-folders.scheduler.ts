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
import { BACKUP_JOB_TYPES } from './backup.constants';
import { BackupSpecificFoldersService } from './backup-specific-folders.service';

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
 * D313 — tick every minute; at configured Tunis hour run specific-folder auto backup.
 */
@Injectable()
export class BackupSpecificFoldersScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BackupSpecificFoldersScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly lastRunByCompany = new Map<string, string>();
  private ticking = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly specific: BackupSpecificFoldersService,
    @Optional() private readonly jobs?: JobEnqueueService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, 60_000);
    setTimeout(() => void this.tick(), 18_000);
    this.logger.log(
      'Backup specific-folders scheduler armed (Africa/Tunis)',
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

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
        const cfg = await this.specific.getConfig(state.companyId);
        if (!cfg.enabled || !cfg.auto.enabled) continue;
        const last = this.lastRunByCompany.get(state.companyId) ?? null;
        if (clock.hour !== cfg.auto.hourTunis || last === clock.date) continue;

        try {
          await this.dispatch(state.companyId, clock.date);
          this.lastRunByCompany.set(state.companyId, clock.date);
        } catch (err) {
          this.logger.warn(
            `specific-folders schedule failed company=${state.companyId}: ${
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
    const idempotencyKey = `backup.sf.auto:${companyId}:${date}`;
    // Domain runScheduled creates backup + executes; Thunder optional for HOW tracking.
    if (this.jobs && thunderWorkersEnabled()) {
      void idempotencyKey;
      void BACKUP_JOB_TYPES;
    }
    const result = await this.specific.runScheduled(companyId);
    this.logger.log(
      `specific-folders auto company=${companyId} backupId=${result.backupId}`,
    );
  }
}

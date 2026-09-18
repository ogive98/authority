import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_SETTING_DEFAULTS,
  buildScopeKey,
} from '../settings/settings.constants';
import { bindBackupRetentionRunner } from './backup-retention.runner';

export interface RetentionRunResult {
  companyId: string;
  enabled: boolean;
  keepDays: number;
  cutoffIso: string;
  scanned: number;
  softDeleted: number;
  skippedLocked: number;
  backupIds: string[];
}

@Injectable()
export class BackupRetentionService implements OnModuleInit {
  private readonly logger = new Logger(BackupRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  onModuleInit(): void {
    bindBackupRetentionRunner(async (companyId, opts) =>
      this.runRetention(companyId, opts),
    );
  }

  async runRetention(
    companyId: string,
    opts?: { force?: boolean; actorUserId?: string; correlationId?: string },
  ): Promise<RetentionRunResult> {
    const retentionEnabled = await this.readBooleanSetting(
      companyId,
      'backup.retention.enabled',
    );
    if (!opts?.force && !retentionEnabled) {
      return {
        companyId,
        enabled: false,
        keepDays: 0,
        cutoffIso: new Date().toISOString(),
        scanned: 0,
        softDeleted: 0,
        skippedLocked: 0,
        backupIds: [],
      };
    }

    const keepDays = await this.readKeepDays(companyId);
    const lockedNeverDelete = await this.readBooleanSetting(
      companyId,
      'backup.retention.lockedNeverDelete',
    );
    const cutoff = new Date(Date.now() - keepDays * 86_400_000);

    const candidates = await this.prisma.bckBackup.findMany({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
      select: {
        id: true,
        locked: true,
        createdAt: true,
      },
    });

    let softDeleted = 0;
    let skippedLocked = 0;
    const backupIds: string[] = [];

    for (const row of candidates) {
      if (row.locked && lockedNeverDelete) {
        skippedLocked += 1;
        continue;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.bckBackup.update({
          where: { id: row.id },
          data: {
            deletedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await this.auditService.append(tx, {
          companyId,
          actorUserId: opts?.actorUserId ?? 'system',
          action: AUDIT_ACTIONS.backupRetentionPurge,
          entityType: AUDIT_ENTITY_TYPES.bckBackup,
          entityId: row.id,
          afterJson: {
            softDeleted: true,
            keepDays,
            cutoff: cutoff.toISOString(),
            locked: row.locked,
          },
          correlationId: opts?.correlationId,
        });
      });
      softDeleted += 1;
      backupIds.push(row.id);
    }

    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.enqueue(tx, {
        companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
        aggregateId: companyId,
        eventType: OUTBOX_EVENT_TYPES.backupRetentionCompleted,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupRetentionCompleted,
          eventVersion: 1,
          source: 'backup',
          actorId: opts?.actorUserId ?? 'system',
          companyId,
          correlationId: opts?.correlationId ?? null,
          payload: {
            keepDays,
            softDeleted,
            skippedLocked,
            scanned: candidates.length,
          },
        },
      });
    });

    const result: RetentionRunResult = {
      companyId,
      enabled: true,
      keepDays,
      cutoffIso: cutoff.toISOString(),
      scanned: candidates.length,
      softDeleted,
      skippedLocked,
      backupIds,
    };
    this.logger.log(
      `retention company=${companyId} deleted=${softDeleted} lockedSkipped=${skippedLocked} scanned=${candidates.length}`,
    );
    return result;
  }

  private async readBooleanSetting(
    companyId: string,
    key:
      | 'backup.retention.enabled'
      | 'backup.retention.lockedNeverDelete'
      | 'backup.schedule.enabled',
  ): Promise<boolean> {
    const fallback = BACKUP_SETTING_DEFAULTS[key];
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    if (!row) return Boolean(fallback);
    return row.valueJson === true;
  }

  private async readKeepDays(companyId: string): Promise<number> {
    const key = 'backup.retention.keepDays' as const;
    const fallback = Number(BACKUP_SETTING_DEFAULTS[key]);
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    if (!row) return fallback;
    const raw = row.valueJson;
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : fallback;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(3650, Math.max(1, Math.trunc(n)));
  }

  async isScheduleEnabled(companyId: string): Promise<boolean> {
    return this.readBooleanSetting(companyId, 'backup.schedule.enabled');
  }

  async resolveScheduleHour(companyId: string): Promise<number> {
    const key = 'backup.schedule.hourTunis' as const;
    const fallback = Number(BACKUP_SETTING_DEFAULTS[key]);
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    if (!row) return fallback;
    const raw = row.valueJson;
    const n =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number(raw)
          : fallback;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(23, Math.max(0, Math.trunc(n)));
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SetLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BACKUP_SETTING_DEFAULTS,
  buildScopeKey,
} from '../settings/settings.constants';
import { bindBackupAutoCreateRunner } from './backup-auto.runner';
import type { AutoBackupRunResult } from './backup-auto.runner';
import { BackupService } from './backup.service';

@Injectable()
export class BackupAutoService implements OnModuleInit {
  private readonly logger = new Logger(BackupAutoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly backup: BackupService,
  ) {}

  onModuleInit(): void {
    bindBackupAutoCreateRunner(async (companyId, opts) =>
      this.runScheduledCreate(companyId, opts),
    );
  }

  async isAutoBackupEnabled(companyId: string): Promise<boolean> {
    return this.readBoolean(companyId, 'backup.autoBackup.enabled');
  }

  async resolveAutoHour(companyId: string): Promise<number> {
    const key = 'backup.autoBackup.hourTunis' as const;
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

  async resolveAutoScope(
    companyId: string,
  ): Promise<'CONFIGURATION' | 'DATABASE'> {
    const key = 'backup.autoBackup.scope' as const;
    const fallback = String(BACKUP_SETTING_DEFAULTS[key]);
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    const raw = row ? row.valueJson : fallback;
    return raw === 'CONFIGURATION' ? 'CONFIGURATION' : 'DATABASE';
  }

  async runScheduledCreate(
    companyId: string,
    opts?: { correlationId?: string },
  ): Promise<AutoBackupRunResult> {
    const enabled = await this.isAutoBackupEnabled(companyId);
    if (!enabled) {
      throw new Error('autoBackup disabled');
    }
    const scope = await this.resolveAutoScope(companyId);
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Tunis',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const created = await this.backup.createBackup({
      companyId,
      // Scheduled system actor — no user UUID (createdBy nullable).
      actorUserId: undefined,
      label: `auto-${scope.toLowerCase()}-${date}`,
      scope,
      correlationId: opts?.correlationId,
    });

    this.logger.log(
      `auto-backup created company=${companyId} id=${created.id} scope=${scope}`,
    );

    return {
      companyId,
      backupId: created.id,
      scope: created.scope,
      restorable: created.restorable,
      label: created.label,
    };
  }

  private async readBoolean(
    companyId: string,
    key: 'backup.autoBackup.enabled',
  ): Promise<boolean> {
    const fallback = Boolean(BACKUP_SETTING_DEFAULTS[key]);
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    if (!row) return fallback;
    return row.valueJson === true;
  }
}

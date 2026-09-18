import { createHash } from 'crypto';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BckBackupScope,
  BckBackupStatus,
  BckBackupType,
  BckDestinationHealth,
  BckDestinationType,
  BckJobStatus,
  BckRestoreStatus,
  Prisma,
  SetLevel,
} from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { AuthService } from '../identity/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildInstallableDatabaseArtifact,
  dryValidateInstallableArtifact,
} from './backup-dump.util';
import {
  applyLogicalCompanyDump,
  detectDumpMode,
} from './backup-restore.util';
import {
  BACKUP_ERROR_CODES,
  BACKUP_LOCAL_ROOT,
  BUSINESS_FOLDER_TEMPLATES,
  RESTORE_CONFIRM_PHRASE,
} from './backup.constants';
import { BackupException } from './backup.exception';
import {
  businessFolderTemplates,
  createLocalDiskDirectory,
  createSandboxDirectory,
  ensureCompanyLocalDisk,
  ensureCompanySandbox,
  listSandboxDirectories,
  localDiskArtifactUnderRoot,
  normalizeLocalSubpath,
  resolveLocalDiskRelative,
} from './backup-path-security';
import {
  BACKUP_SETTING_DEFAULTS,
  BACKUP_SETTING_KEYS,
  BACKUP_SETTING_META,
  buildScopeKey,
} from '../settings/settings.constants';

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly auth: AuthService,
  ) {}

  async dashboard(companyId: string) {
    const [
      total,
      verified,
      failed,
      locked,
      restorable,
      lastBackup,
      lastVerified,
      openRestores,
    ] = await Promise.all([
      this.prisma.bckBackup.count({
        where: { companyId, deletedAt: null },
      }),
      this.prisma.bckBackup.count({
        where: {
          companyId,
          deletedAt: null,
          status: BckBackupStatus.VERIFIED,
        },
      }),
      this.prisma.bckBackup.count({
        where: {
          companyId,
          deletedAt: null,
          status: BckBackupStatus.FAILED,
        },
      }),
      this.prisma.bckBackup.count({
        where: { companyId, deletedAt: null, locked: true },
      }),
      this.prisma.bckBackup.count({
        where: { companyId, deletedAt: null, restorable: true },
      }),
      this.prisma.bckBackup.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          label: true,
          scope: true,
          status: true,
          restorable: true,
          createdAt: true,
        },
      }),
      this.prisma.bckBackup.findFirst({
        where: {
          companyId,
          deletedAt: null,
          status: BckBackupStatus.VERIFIED,
        },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          label: true,
          scope: true,
          status: true,
          restorable: true,
          completedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.bckRestoreRequest.count({
        where: {
          companyId,
          status: {
            in: [
              BckRestoreStatus.PENDING_SECOND_APPROVAL,
              BckRestoreStatus.DRY_VALIDATED,
            ],
          },
          applied: false,
        },
      }),
    ]);

    const autoEnabled = await this.readCompanyBoolean(
      companyId,
      'backup.autoBackup.enabled',
    );
    const autoHour = await this.readCompanyHour(
      companyId,
      'backup.autoBackup.hourTunis',
      2,
    );
    const retentionScheduleOn = await this.readCompanyBoolean(
      companyId,
      'backup.schedule.enabled',
    );
    const retentionHour = await this.readCompanyHour(
      companyId,
      'backup.schedule.hourTunis',
      3,
    );

    return {
      companyId,
      counts: { total, verified, failed, locked, restorable },
      lastBackup: lastBackup
        ? {
            id: lastBackup.id,
            label: lastBackup.label,
            scope: lastBackup.scope,
            status: lastBackup.status,
            restorable: lastBackup.restorable,
            createdAt: lastBackup.createdAt.toISOString(),
          }
        : null,
      lastVerified: lastVerified
        ? {
            id: lastVerified.id,
            label: lastVerified.label,
            scope: lastVerified.scope,
            status: lastVerified.status,
            restorable: lastVerified.restorable,
            createdAt: (
              lastVerified.completedAt ?? lastVerified.createdAt
            ).toISOString(),
          }
        : null,
      openRestoreRequests: openRestores,
      schedule: {
        autoBackup: {
          enabled: autoEnabled,
          hourTunis: autoHour,
          timezone: 'Africa/Tunis',
        },
        retention: {
          enabled: retentionScheduleOn,
          hourTunis: retentionHour,
          timezone: 'Africa/Tunis',
        },
      },
      note: 'D309 — real last/next schedule only; no invented storage/RPO KPIs',
    };
  }

  async listBackups(companyId: string) {
    const rows = await this.prisma.bckBackup.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { manifest: true },
    });
    return { backups: rows.map((row) => this.toBackupDto(row)) };
  }

  async getBackup(companyId: string, id: string) {
    const row = await this.findActive(companyId, id);
    return this.toBackupDto(row);
  }

  async listJobs(companyId: string) {
    const jobs = await this.prisma.bckJob.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { jobs };
  }

  async listDestinations(companyId: string) {
    const destination = await this.ensureLocalDestination(companyId);
    const rows = await this.prisma.bckDestination.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return {
      destinations: rows.length > 0 ? rows : [destination],
    };
  }

  async listPolicies(companyId: string) {
    await this.ensureDefaultPolicy(companyId);
    const policies = await this.prisma.bckPolicy.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { policies };
  }

  /** Effective backup.* prefs for Ops / Prefs UI (defaults when unset). */
  async effectiveSettings(companyId: string) {
    const keys = [...BACKUP_SETTING_KEYS];
    const scopeKey = buildScopeKey(SetLevel.COMPANY, { companyId });
    const rows = await this.prisma.setValue.findMany({
      where: {
        defKey: { in: keys },
        scopeKey,
        deletedAt: null,
      },
    });
    const byKey = new Map(rows.map((r) => [r.defKey, r.valueJson]));
    return {
      companyId,
      settings: keys.map((key) => ({
        key,
        value: byKey.has(key)
          ? byKey.get(key)
          : BACKUP_SETTING_DEFAULTS[key],
        source: byKey.has(key) ? 'COMPANY' : 'DEFAULT',
        description: BACKUP_SETTING_META[key].description,
      })),
    };
  }

  async listRestoreRequests(companyId: string) {
    const rows = await this.prisma.bckRestoreRequest.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { restoreRequests: rows.map((row) => this.toRestoreDto(row)) };
  }

  /**
   * Create backup:
   * - CONFIGURATION → manifest-only, restorable:false (D304)
   * - DATABASE → installable dump + file inventory, restorable:true (D305)
   */
  async createBackup(input: {
    companyId: string;
    /** Optional — scheduled system runs omit user UUID. */
    actorUserId?: string;
    label?: string;
    scope?: 'CONFIGURATION' | 'DATABASE';
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const scope =
      input.scope === 'DATABASE'
        ? BckBackupScope.DATABASE
        : BckBackupScope.CONFIGURATION;
    const destination = await this.ensureLocalDestination(input.companyId);
    const defaultLabel =
      scope === BckBackupScope.DATABASE
        ? 'database-installable'
        : 'configuration-manifest';
    const actorUserId = input.actorUserId?.trim() || null;

    const created = await this.prisma.$transaction(async (tx) => {
      const backup = await tx.bckBackup.create({
        data: {
          companyId: input.companyId,
          siteId: input.siteId ?? null,
          type: BckBackupType.FULL,
          scope,
          status: BckBackupStatus.RUNNING,
          restorable: false,
          label: input.label?.trim() || defaultLabel,
          destinationId: destination.id,
          createdByUserId: actorUserId,
          startedAt: new Date(),
        },
      });

      const job = await tx.bckJob.create({
        data: {
          companyId: input.companyId,
          backupId: backup.id,
          status: BckJobStatus.RUNNING,
          progress: 10,
          attempts: 1,
          startedAt: new Date(),
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: actorUserId ?? undefined,
        action: AUDIT_ACTIONS.backupCreate,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: backup.id,
        afterJson: {
          scope,
          restorable: false,
          destinationId: destination.id,
          scheduled: !actorUserId,
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
        aggregateId: backup.id,
        eventType: OUTBOX_EVENT_TYPES.backupRequested,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupRequested,
          eventVersion: 1,
          source: 'backup',
          actorId: actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: { backupId: backup.id, scope, jobId: job.id },
        },
      });

      return { backup, job };
    });

    try {
      if (scope === BckBackupScope.DATABASE) {
        return await this.finalizeDatabaseBackup({
          companyId: input.companyId,
          actorUserId,
          backupId: created.backup.id,
          jobId: created.job.id,
          destinationId: destination.id,
          correlationId: input.correlationId,
        });
      }

      return await this.finalizeConfigurationBackup({
        companyId: input.companyId,
        actorUserId,
        backupId: created.backup.id,
        jobId: created.job.id,
        destinationId: destination.id,
        correlationId: input.correlationId,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Backup artifact write failed';
      await this.prisma.$transaction(async (tx) => {
        await tx.bckBackup.update({
          where: { id: created.backup.id },
          data: {
            status: BckBackupStatus.FAILED,
            errorCode: BACKUP_ERROR_CODES.DUMP_FAILED,
            errorMessage: message,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await tx.bckJob.update({
          where: { id: created.job.id },
          data: {
            status: BckJobStatus.FAILED,
            errorCode: BACKUP_ERROR_CODES.DUMP_FAILED,
            errorMessage: message,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        await this.outboxService.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
          aggregateId: created.backup.id,
          eventType: OUTBOX_EVENT_TYPES.backupFailed,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.backupFailed,
            eventVersion: 1,
            source: 'backup',
            actorId: actorUserId,
            companyId: input.companyId,
            correlationId: input.correlationId ?? null,
            payload: { backupId: created.backup.id, message },
          },
        });
      });
      throw error;
    }
  }

  async verify(input: {
    companyId: string;
    backupId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const row = await this.findActive(input.companyId, input.backupId);
    if (!row.artifactPath || !row.checksumSha256) {
      throw new BackupException(
        BACKUP_ERROR_CODES.ARTIFACT_MISSING,
        'Backup has no artifact to verify.',
        HttpStatus.CONFLICT,
      );
    }

    const absolutePath = join(
      process.cwd(),
      BACKUP_LOCAL_ROOT,
      row.artifactPath,
    );
    let bytes: Buffer;
    try {
      bytes = await readFile(absolutePath);
    } catch {
      const updated = await this.prisma.bckBackup.update({
        where: { id: row.id },
        data: {
          status: BckBackupStatus.CORRUPTED,
          restorable: false,
          errorCode: BACKUP_ERROR_CODES.ARTIFACT_MISSING,
          errorMessage: 'Artifact file missing on disk',
          version: { increment: 1 },
        },
        include: { manifest: true },
      });
      return this.toBackupDto(updated);
    }

    const checksum = createHash('sha256').update(bytes).digest('hex');
    const ok = checksum === row.checksumSha256;
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.bckBackup.update({
        where: { id: row.id },
        data: {
          status: ok ? BckBackupStatus.VERIFIED : BckBackupStatus.CORRUPTED,
          restorable: ok ? row.restorable : false,
          errorCode: ok ? null : BACKUP_ERROR_CODES.ARTIFACT_MISSING,
          errorMessage: ok ? null : 'Checksum mismatch',
          version: { increment: 1 },
        },
        include: { manifest: true },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupVerify,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: row.id,
        afterJson: { ok, status: next.status, restorable: next.restorable },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      return next;
    });
    return this.toBackupDto(updated);
  }

  async lock(input: {
    companyId: string;
    backupId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const row = await this.findActive(input.companyId, input.backupId);
    if (
      row.status !== BckBackupStatus.VERIFIED &&
      row.status !== BckBackupStatus.LOCKED
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Only VERIFIED backups can be locked (got ${row.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.bckBackup.update({
        where: { id: row.id },
        data: {
          locked: true,
          status: BckBackupStatus.LOCKED,
          version: { increment: 1 },
        },
        include: { manifest: true },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupLock,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: row.id,
        afterJson: { locked: true },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      return next;
    });
    return this.toBackupDto(updated);
  }

  /**
   * Request restore (step 1/2 dual-control). Requires password re-auth.
   * Non-restorable backups stay blocked (D304 honesty).
   */
  async requestRestore(input: {
    companyId: string;
    backupId: string;
    actorUserId: string;
    password?: string;
    confirm?: boolean;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const backup = await this.findActive(input.companyId, input.backupId);
    if (!backup.restorable) {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_NOT_INSTALLABLE,
        'Restore BLOCKED: artifact is not installable (restorable:false).',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      backup.status !== BckBackupStatus.VERIFIED &&
      backup.status !== BckBackupStatus.LOCKED
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Only VERIFIED/LOCKED restorable backups can be restored (got ${backup.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    if (!input.confirm) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        'confirm=true is required to request restore.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!input.password?.trim()) {
      throw new BackupException(
        BACKUP_ERROR_CODES.REAUTH_REQUIRED,
        'Session password is required to request restore.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.auth.verifyCurrentPassword({
      userId: input.actorUserId,
      password: input.password,
      ip: input.ip,
    });

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.bckRestoreRequest.create({
        data: {
          companyId: input.companyId,
          backupId: backup.id,
          status: BckRestoreStatus.PENDING_SECOND_APPROVAL,
          requestedByUserId: input.actorUserId,
          approvedByUserId: input.actorUserId,
          approvedAt: new Date(),
        },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupRestoreRequest,
        entityType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        entityId: created.id,
        afterJson: {
          backupId: backup.id,
          status: created.status,
          dualControlRequired: true,
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        aggregateId: created.id,
        eventType: OUTBOX_EVENT_TYPES.backupRestoreRequested,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupRestoreRequested,
          eventVersion: 1,
          source: 'backup',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: { restoreRequestId: created.id, backupId: backup.id },
        },
      });
      return created;
    });

    return {
      ...this.toRestoreDto(row),
      dualControlRequired: true,
      note: 'Awaiting distinct second approver (D305). After dry-validate, use apply wizard (D307).',
    };
  }

  /**
   * D307 restore wizard apply:
   * DRY_VALIDATED → re-auth + confirmPhrase → safety backup → logical apply → health.
   * Full cluster pg_restore remains BLOCKED on shared DB.
   */
  async applyRestore(input: {
    companyId: string;
    restoreRequestId: string;
    actorUserId: string;
    password?: string;
    confirmPhrase?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const request = await this.prisma.bckRestoreRequest.findFirst({
      where: {
        id: input.restoreRequestId,
        companyId: input.companyId,
      },
    });
    if (!request) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Restore request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (request.status !== BckRestoreStatus.DRY_VALIDATED) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Restore request must be DRY_VALIDATED before apply (got ${request.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    if (request.applied) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        'Restore request was already applied.',
        HttpStatus.CONFLICT,
      );
    }
    if (!input.password?.trim()) {
      throw new BackupException(
        BACKUP_ERROR_CODES.REAUTH_REQUIRED,
        'Session password is required to apply restore.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (input.confirmPhrase !== RESTORE_CONFIRM_PHRASE) {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_CONFIRM_REQUIRED,
        `Typed confirmation ${RESTORE_CONFIRM_PHRASE} is required to apply restore.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.auth.verifyCurrentPassword({
      userId: input.actorUserId,
      password: input.password,
      ip: input.ip,
    });

    const backup = await this.findActive(input.companyId, request.backupId);
    if (!backup.restorable || !backup.artifactPath) {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_NOT_INSTALLABLE,
        'Backup is no longer installable.',
        HttpStatus.FORBIDDEN,
      );
    }

    const dumpAbsolute = join(
      process.cwd(),
      BACKUP_LOCAL_ROOT,
      backup.artifactPath,
    );

    let dumpMode: string;
    try {
      dumpMode = await detectDumpMode({
        artifactAbsolutePath: dumpAbsolute,
        expectedChecksum: backup.checksumSha256,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Dump validation failed';
      throw new BackupException(
        BACKUP_ERROR_CODES.ARTIFACT_MISSING,
        message,
        HttpStatus.CONFLICT,
      );
    }

    if (dumpMode === 'pg_dump') {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_CLUSTER_BLOCKED,
        'Full cluster pg_restore is BLOCKED on shared AUTHORITY DB. Use a logical_company dump or staging (deferred).',
        HttpStatus.FORBIDDEN,
      );
    }
    if (dumpMode !== 'logical_company') {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_NOT_INSTALLABLE,
        `Unsupported dump mode for live apply: ${dumpMode}`,
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.bckRestoreRequest.update({
      where: { id: request.id },
      data: {
        status: BckRestoreStatus.APPLYING,
        version: { increment: 1 },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        aggregateId: request.id,
        eventType: OUTBOX_EVENT_TYPES.backupRestoreStarted,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupRestoreStarted,
          eventVersion: 1,
          source: 'backup',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: { restoreRequestId: request.id, backupId: backup.id },
        },
      });
    });

    try {
      let safetyBackupId: string | null = null;
      const safetyRequired = await this.isSafetyBackupRequired(input.companyId);
      if (safetyRequired) {
        const safety = await this.createBackup({
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          label: `safety-pre-restore-${request.id.slice(0, 8)}`,
          scope: 'DATABASE',
          ip: input.ip,
          userAgent: input.userAgent,
          correlationId: input.correlationId,
        });
        safetyBackupId = safety.id;
      }

      const applied = await applyLogicalCompanyDump({
        prisma: this.prisma,
        companyId: input.companyId,
        artifactAbsolutePath: dumpAbsolute,
        expectedChecksum: backup.checksumSha256,
      });

      if (!applied.health.ok) {
        await this.prisma.bckRestoreRequest.update({
          where: { id: request.id },
          data: {
            status: BckRestoreStatus.HEALTH_FAILED,
            safetyBackupId,
            healthReportJson: applied.health as unknown as Prisma.InputJsonValue,
            errorCode: BACKUP_ERROR_CODES.RESTORE_HEALTH_FAILED,
            errorMessage: 'Post-restore health check failed',
            version: { increment: 1 },
          },
        });
        throw new BackupException(
          BACKUP_ERROR_CODES.RESTORE_HEALTH_FAILED,
          'Post-restore health check failed.',
          HttpStatus.CONFLICT,
        );
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        const next = await tx.bckRestoreRequest.update({
          where: { id: request.id },
          data: {
            status: BckRestoreStatus.APPLIED,
            applied: true,
            appliedAt: new Date(),
            safetyBackupId,
            healthReportJson: applied.health as unknown as Prisma.InputJsonValue,
            errorCode: null,
            errorMessage: null,
            version: { increment: 1 },
          },
        });
        await this.auditService.append(tx, {
          companyId: input.companyId,
          actorUserId: input.actorUserId,
          action: AUDIT_ACTIONS.backupRestoreApply,
          entityType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
          entityId: request.id,
          afterJson: {
            status: next.status,
            applied: true,
            safetyBackupId,
            modulesUpserted: applied.modulesUpserted,
            settingsUpserted: applied.settingsUpserted,
            healthOk: applied.health.ok,
          },
          ip: input.ip,
          device: input.userAgent,
          correlationId: input.correlationId,
        });
        await this.outboxService.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
          aggregateId: request.id,
          eventType: OUTBOX_EVENT_TYPES.backupRestoreCompleted,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.backupRestoreCompleted,
            eventVersion: 1,
            source: 'backup',
            actorId: input.actorUserId,
            companyId: input.companyId,
            correlationId: input.correlationId ?? null,
            payload: {
              restoreRequestId: request.id,
              backupId: backup.id,
              applied: true,
              safetyBackupId,
              dumpMode: applied.dumpMode,
            },
          },
        });
        return next;
      });

      return {
        ...this.toRestoreDto(updated),
        applied: true,
        safetyBackupId,
        dumpMode: applied.dumpMode,
        modulesUpserted: applied.modulesUpserted,
        settingsUpserted: applied.settingsUpserted,
        filesNoted: applied.filesNoted,
        health: applied.health,
        note: 'D307 logical company restore applied. Cluster pg_restore remains blocked.',
      };
    } catch (error) {
      if (error instanceof BackupException) {
        await this.prisma.$transaction(async (tx) => {
          await this.outboxService.enqueue(tx, {
            companyId: input.companyId,
            aggregateType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
            aggregateId: request.id,
            eventType: OUTBOX_EVENT_TYPES.backupRestoreFailed,
            payloadJson: {
              eventType: OUTBOX_EVENT_TYPES.backupRestoreFailed,
              eventVersion: 1,
              source: 'backup',
              actorId: input.actorUserId,
              companyId: input.companyId,
              correlationId: input.correlationId ?? null,
              payload: {
                restoreRequestId: request.id,
                code: error.code,
                message: error.message,
              },
            },
          });
        });
        throw error;
      }
      const message =
        error instanceof Error ? error.message : 'Restore apply failed';
      await this.prisma.bckRestoreRequest.update({
        where: { id: request.id },
        data: {
          status: BckRestoreStatus.FAILED,
          errorCode: BACKUP_ERROR_CODES.DUMP_FAILED,
          errorMessage: message,
          version: { increment: 1 },
        },
      });
      throw new BackupException(
        BACKUP_ERROR_CODES.DUMP_FAILED,
        message,
        HttpStatus.CONFLICT,
      );
    }
  }

  private async isSafetyBackupRequired(companyId: string): Promise<boolean> {
    const key = 'backup.restore.safetyBackup.required' as const;
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

  async approveRestore(input: {
    companyId: string;
    restoreRequestId: string;
    actorUserId: string;
    password?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const request = await this.prisma.bckRestoreRequest.findFirst({
      where: {
        id: input.restoreRequestId,
        companyId: input.companyId,
      },
    });
    if (!request) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Restore request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (request.status !== BckRestoreStatus.PENDING_SECOND_APPROVAL) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Restore request is not awaiting second approval (got ${request.status}).`,
        HttpStatus.CONFLICT,
      );
    }
    if (request.requestedByUserId === input.actorUserId) {
      throw new BackupException(
        BACKUP_ERROR_CODES.SAME_APPROVER,
        'Dual-control requires a distinct second approver.',
        HttpStatus.CONFLICT,
      );
    }
    if (!input.password?.trim()) {
      throw new BackupException(
        BACKUP_ERROR_CODES.REAUTH_REQUIRED,
        'Session password is required to approve restore.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.auth.verifyCurrentPassword({
      userId: input.actorUserId,
      password: input.password,
      ip: input.ip,
    });

    const backup = await this.findActive(input.companyId, request.backupId);
    if (!backup.restorable || !backup.artifactPath) {
      throw new BackupException(
        BACKUP_ERROR_CODES.RESTORE_NOT_INSTALLABLE,
        'Backup is no longer installable.',
        HttpStatus.FORBIDDEN,
      );
    }

    const dumpAbsolute = join(
      process.cwd(),
      BACKUP_LOCAL_ROOT,
      backup.artifactPath,
    );

    let validation: { ok: true; dumpMode: string };
    try {
      validation = await dryValidateInstallableArtifact({
        artifactAbsolutePath: dumpAbsolute,
        expectedChecksum: backup.checksumSha256,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Dry-validate failed';
      await this.prisma.bckRestoreRequest.update({
        where: { id: request.id },
        data: {
          status: BckRestoreStatus.FAILED,
          errorCode: BACKUP_ERROR_CODES.ARTIFACT_MISSING,
          errorMessage: message,
          version: { increment: 1 },
        },
      });
      throw new BackupException(
        BACKUP_ERROR_CODES.ARTIFACT_MISSING,
        message,
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.bckRestoreRequest.update({
        where: { id: request.id },
        data: {
          status: BckRestoreStatus.DRY_VALIDATED,
          secondApprovedByUserId: input.actorUserId,
          secondApprovedAt: new Date(),
          dryValidatedAt: new Date(),
          applied: false,
          version: { increment: 1 },
        },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupRestoreApprove,
        entityType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        entityId: request.id,
        afterJson: {
          status: next.status,
          applied: false,
          dumpMode: validation.dumpMode,
          nextStep: 'apply-wizard-d307',
        },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        aggregateId: request.id,
        eventType: OUTBOX_EVENT_TYPES.backupRestoreAuthorized,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupRestoreAuthorized,
          eventVersion: 1,
          source: 'backup',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            restoreRequestId: request.id,
            backupId: backup.id,
            applied: false,
            dumpMode: validation.dumpMode,
          },
        },
      });
      return next;
    });

    return {
      ...this.toRestoreDto(updated),
      applied: false,
      dumpMode: validation.dumpMode,
      note: 'Authorized + dry-validated. Call POST …/apply with confirmPhrase RESTORE (D307).',
    };
  }

  async softDelete(input: {
    companyId: string;
    backupId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const row = await this.findActive(input.companyId, input.backupId);
    if (row.locked) {
      throw new BackupException(
        BACKUP_ERROR_CODES.LOCKED,
        'Locked backups cannot be deleted by retention/automation.',
        HttpStatus.CONFLICT,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.bckBackup.update({
        where: { id: row.id },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupDelete,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: row.id,
        afterJson: { deleted: true },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
    });
    return { ok: true, backupId: row.id };
  }

  private async finalizeConfigurationBackup(input: {
    companyId: string;
    actorUserId?: string | null;
    backupId: string;
    jobId: string;
    destinationId: string;
    correlationId?: string;
  }) {
    const moduleStates = await this.prisma.modModuleState.findMany({
      where: { companyId: input.companyId },
      orderBy: { moduleKey: 'asc' },
    });
    const moduleVersions: Record<string, string> = {};
    for (const row of moduleStates) {
      moduleVersions[row.moduleKey] = row.status;
    }

    const manifestBody = {
      backupId: input.backupId,
      companyId: input.companyId,
      scope: BckBackupScope.CONFIGURATION,
      kind: 'metadata-manifest',
      restorable: false,
      applicationVersion: process.env.npm_package_version ?? '0.0.0',
      schemaVersion: 'd304',
      moduleVersions,
      createdAt: new Date().toISOString(),
      note: 'D304/D305 configuration manifest-only — not an installable SOC backup',
    };

    const localSubpath = await this.readLocalSubpath(input.companyId);
    const relativePath = localDiskArtifactUnderRoot(
      input.companyId,
      `${input.backupId}.manifest.json`,
      localSubpath,
    );
    const absolutePath = join(process.cwd(), BACKUP_LOCAL_ROOT, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    const raw = JSON.stringify(manifestBody, null, 2);
    await writeFile(absolutePath, raw, 'utf8');
    const checksum = createHash('sha256').update(raw).digest('hex');
    const sizeBytes = BigInt(Buffer.byteLength(raw, 'utf8'));

    const finalized = await this.prisma.$transaction(async (tx) => {
      await tx.bckManifest.create({
        data: {
          backupId: input.backupId,
          applicationVersion: manifestBody.applicationVersion,
          schemaVersion: manifestBody.schemaVersion,
          moduleVersionsJson: moduleVersions as Prisma.InputJsonValue,
          scopeMetadataJson: {
            scope: BckBackupScope.CONFIGURATION,
            kind: 'metadata-manifest',
          } as Prisma.InputJsonValue,
          checksumAlgorithm: 'sha256',
        },
      });

      const backup = await tx.bckBackup.update({
        where: { id: input.backupId },
        data: {
          status: BckBackupStatus.VERIFIED,
          restorable: false,
          checksumSha256: checksum,
          sizeBytes,
          artifactPath: relativePath,
          completedAt: new Date(),
          version: { increment: 1 },
        },
        include: { manifest: true },
      });

      await tx.bckJob.update({
        where: { id: input.jobId },
        data: {
          status: BckJobStatus.SUCCEEDED,
          progress: 100,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await tx.bckDestination.update({
        where: { id: input.destinationId },
        data: { healthStatus: BckDestinationHealth.HEALTHY },
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
        aggregateId: backup.id,
        eventType: OUTBOX_EVENT_TYPES.backupCompleted,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupCompleted,
          eventVersion: 1,
          source: 'backup',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            backupId: backup.id,
            restorable: false,
            checksum,
          },
        },
      });

      return backup;
    });

    return this.toBackupDto(finalized);
  }

  private async finalizeDatabaseBackup(input: {
    companyId: string;
    actorUserId?: string | null;
    backupId: string;
    jobId: string;
    destinationId: string;
    correlationId?: string;
  }) {
    const localSubpath = await this.readLocalSubpath(input.companyId);
    const artifact = await buildInstallableDatabaseArtifact({
      prisma: this.prisma,
      companyId: input.companyId,
      backupId: input.backupId,
      localSubpath,
    });

    // Checksum the dump bytes (installable artifact), not only the sidecar manifest.
    const dumpAbsolute = join(
      process.cwd(),
      BACKUP_LOCAL_ROOT,
      artifact.artifactRelativePath,
    );
    const dumpBytes = await readFile(dumpAbsolute);
    const dumpChecksum = createHash('sha256').update(dumpBytes).digest('hex');

    const finalized = await this.prisma.$transaction(async (tx) => {
      await tx.bckManifest.create({
        data: {
          backupId: input.backupId,
          applicationVersion: artifact.applicationVersion,
          schemaVersion: artifact.schemaVersion,
          moduleVersionsJson: artifact.moduleVersions as Prisma.InputJsonValue,
          scopeMetadataJson: {
            ...artifact.scopeMetadata,
            manifestPath: artifact.manifestRelativePath,
            inventoryPath: artifact.inventoryRelativePath,
            dumpChecksumSha256: dumpChecksum,
          } as Prisma.InputJsonValue,
          checksumAlgorithm: 'sha256',
        },
      });

      const backup = await tx.bckBackup.update({
        where: { id: input.backupId },
        data: {
          status: BckBackupStatus.VERIFIED,
          restorable: true,
          checksumSha256: dumpChecksum,
          sizeBytes: artifact.sizeBytes,
          artifactPath: artifact.artifactRelativePath,
          completedAt: new Date(),
          version: { increment: 1 },
        },
        include: { manifest: true },
      });

      await tx.bckJob.update({
        where: { id: input.jobId },
        data: {
          status: BckJobStatus.SUCCEEDED,
          progress: 100,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });

      await tx.bckDestination.update({
        where: { id: input.destinationId },
        data: { healthStatus: BckDestinationHealth.HEALTHY },
      });

      await this.outboxService.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
        aggregateId: backup.id,
        eventType: OUTBOX_EVENT_TYPES.backupCompleted,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.backupCompleted,
          eventVersion: 1,
          source: 'backup',
          actorId: input.actorUserId,
          companyId: input.companyId,
          correlationId: input.correlationId ?? null,
          payload: {
            backupId: backup.id,
            restorable: true,
            dumpMode: artifact.dumpMode,
            checksum: dumpChecksum,
          },
        },
      });

      return backup;
    });

    return this.toBackupDto(finalized);
  }

  private async findActive(companyId: string, id: string) {
    const row = await this.prisma.bckBackup.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { manifest: true },
    });
    if (!row) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Backup not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async readCompanyBoolean(
    companyId: string,
    key: 'backup.autoBackup.enabled' | 'backup.schedule.enabled',
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

  private async readCompanyHour(
    companyId: string,
    key: 'backup.autoBackup.hourTunis' | 'backup.schedule.hourTunis',
    fallbackDefault: number,
  ): Promise<number> {
    const fallback = Number(BACKUP_SETTING_DEFAULTS[key] ?? fallbackDefault);
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

  /** D309 — probe LOCAL_FS destination path; update healthStatus honestly. */
  async testDestination(input: {
    companyId: string;
    destinationId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const dest = await this.prisma.bckDestination.findFirst({
      where: {
        id: input.destinationId,
        companyId: input.companyId,
        deletedAt: null,
      },
    });
    if (!dest) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Destination not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const absolute = dest.pathRef.replace(/\\/g, '/').startsWith(BACKUP_LOCAL_ROOT)
      ? join(process.cwd(), dest.pathRef)
      : join(process.cwd(), BACKUP_LOCAL_ROOT, dest.pathRef);
    let health: BckDestinationHealth = BckDestinationHealth.HEALTHY;
    let detail = 'LOCAL_FS path reachable';
    try {
      await mkdir(absolute, { recursive: true });
      const probe = join(absolute, `.health-${Date.now()}`);
      await writeFile(probe, 'ok', 'utf8');
      await unlink(probe);
    } catch (error) {
      health = BckDestinationHealth.UNAVAILABLE;
      detail =
        error instanceof Error ? error.message : 'LOCAL_FS probe failed';
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.bckDestination.update({
        where: { id: dest.id },
        data: { healthStatus: health, version: { increment: 1 } },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupDestinationTest,
        entityType: AUDIT_ENTITY_TYPES.bckDestination,
        entityId: dest.id,
        afterJson: { healthStatus: health, detail },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      return next;
    });

    return {
      id: updated.id,
      type: updated.type,
      name: updated.name,
      pathRef: updated.pathRef,
      healthStatus: updated.healthStatus,
      detail,
      ok: health === BckDestinationHealth.HEALTHY,
    };
  }

  /** Cancel a restore still awaiting second approval (requester or manage). */
  async cancelRestore(input: {
    companyId: string;
    restoreRequestId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const request = await this.prisma.bckRestoreRequest.findFirst({
      where: {
        id: input.restoreRequestId,
        companyId: input.companyId,
      },
    });
    if (!request) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Restore request not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      request.status !== BckRestoreStatus.PENDING_SECOND_APPROVAL &&
      request.status !== BckRestoreStatus.REQUESTED
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Only pending restore requests can be cancelled (got ${request.status}).`,
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.bckRestoreRequest.update({
        where: { id: request.id },
        data: {
          status: BckRestoreStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupRestoreCancel,
        entityType: AUDIT_ENTITY_TYPES.bckRestoreRequest,
        entityId: request.id,
        afterJson: { status: next.status },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
      return next;
    });

    return this.toRestoreDto(updated);
  }

  private async ensureLocalDestination(companyId: string) {
    const localSubpath = await this.readLocalSubpath(companyId);
    await ensureCompanyLocalDisk(companyId, localSubpath);
    const pathRef = resolveLocalDiskRelative(
      companyId,
      '.',
      localSubpath,
    ).fromCwd;

    const existing = await this.prisma.bckDestination.findFirst({
      where: {
        companyId,
        deletedAt: null,
        type: BckDestinationType.LOCAL_FS,
        enabled: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) {
      if (existing.pathRef !== pathRef) {
        return this.prisma.bckDestination.update({
          where: { id: existing.id },
          data: { pathRef },
        });
      }
      return existing;
    }
    return this.prisma.bckDestination.create({
      data: {
        companyId,
        type: BckDestinationType.LOCAL_FS,
        name: 'Local filesystem',
        pathRef,
        healthStatus: BckDestinationHealth.UNKNOWN,
        enabled: true,
      },
    });
  }

  private async readLocalSubpath(companyId: string): Promise<string> {
    const key = 'backup.destination.localSubpath' as const;
    const fallback = normalizeLocalSubpath(BACKUP_SETTING_DEFAULTS[key]);
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    if (!row) return fallback;
    try {
      return normalizeLocalSubpath(row.valueJson);
    } catch {
      return fallback;
    }
  }

  /** D314 — list company sandbox directories at path. */
  async listCompanyFiles(companyId: string, path = '') {
    await ensureCompanySandbox(companyId);
    const directories = await listSandboxDirectories(companyId, path || '');
    return {
      companyId,
      path: path || '',
      directories,
      templates: [...businessFolderTemplates()],
      sandboxRootHint: `data/company-files/${companyId}/`,
    };
  }

  /** D314 — create folder under company sandbox. */
  async mkdirCompanyFiles(
    companyId: string,
    input: { path?: string; name: string },
  ) {
    try {
      const created = await createSandboxDirectory(
        companyId,
        input.path || '',
        input.name,
      );
      return {
        relativePath: created.relativePath,
        name: input.name.trim(),
        sandboxRootHint: `data/company-files/${companyId}/`,
      };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'PATH_FORBIDDEN' || code === 'PATH_TRAVERSAL') {
        throw new BackupException(
          BACKUP_ERROR_CODES[code as 'PATH_FORBIDDEN' | 'PATH_TRAVERSAL'],
          error instanceof Error ? error.message : 'Path rejected',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'EEXIST') {
        throw new BackupException(
          BACKUP_ERROR_CODES.PATH_FORBIDDEN,
          'Folder already exists.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  /** D314 — resolve effective LOCAL_DISK root for company. */
  async resolveLocalDisk(companyId: string) {
    const localSubpath = await this.readLocalSubpath(companyId);
    const resolved = resolveLocalDiskRelative(companyId, '.', localSubpath);
    await ensureCompanyLocalDisk(companyId, localSubpath);
    return {
      companyId,
      localSubpath,
      fromCwd: resolved.fromCwd,
      underLocalRoot: resolved.underLocalRoot,
      templates: [...BUSINESS_FOLDER_TEMPLATES],
    };
  }

  /** D314 — create folder under LOCAL_DISK company root (+ Prefs subpath). */
  async mkdirLocalDisk(
    companyId: string,
    input: { path?: string; name: string },
  ) {
    const localSubpath = await this.readLocalSubpath(companyId);
    try {
      const created = await createLocalDiskDirectory(
        companyId,
        input.path || '',
        input.name,
        localSubpath,
      );
      return {
        relativePath: created.relativePath,
        underLocalRoot: created.underLocalRoot,
        fromCwd: created.fromCwd,
        localSubpath,
      };
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : '';
      if (code === 'PATH_FORBIDDEN' || code === 'PATH_TRAVERSAL') {
        throw new BackupException(
          BACKUP_ERROR_CODES[code as 'PATH_FORBIDDEN' | 'PATH_TRAVERSAL'],
          error instanceof Error ? error.message : 'Path rejected',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'EEXIST') {
        throw new BackupException(
          BACKUP_ERROR_CODES.PATH_FORBIDDEN,
          'Folder already exists.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  private async ensureDefaultPolicy(companyId: string) {
    const existing = await this.prisma.bckPolicy.findFirst({
      where: { companyId, deletedAt: null },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.bckPolicy.create({
      data: {
        companyId,
        name: 'Default configuration manifest',
        scope: BckBackupScope.CONFIGURATION,
        type: BckBackupType.FULL,
        scheduleEnabled: false,
        verificationRequired: true,
        enabled: true,
      },
    });
  }

  private toRestoreDto(row: {
    id: string;
    companyId: string;
    backupId: string;
    status: BckRestoreStatus;
    requestedByUserId: string;
    approvedByUserId: string | null;
    secondApprovedByUserId: string | null;
    requestedAt: Date;
    approvedAt: Date | null;
    secondApprovedAt: Date | null;
    dryValidatedAt: Date | null;
    applied: boolean;
    appliedAt?: Date | null;
    safetyBackupId?: string | null;
    healthReportJson?: Prisma.JsonValue | null;
    errorCode: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      backupId: row.backupId,
      status: row.status,
      requestedByUserId: row.requestedByUserId,
      approvedByUserId: row.approvedByUserId,
      secondApprovedByUserId: row.secondApprovedByUserId,
      requestedAt: row.requestedAt.toISOString(),
      approvedAt: row.approvedAt?.toISOString() ?? null,
      secondApprovedAt: row.secondApprovedAt?.toISOString() ?? null,
      dryValidatedAt: row.dryValidatedAt?.toISOString() ?? null,
      applied: row.applied,
      appliedAt: row.appliedAt?.toISOString() ?? null,
      safetyBackupId: row.safetyBackupId ?? null,
      healthReport: row.healthReportJson ?? null,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toBackupDto(
    row: {
      id: string;
      companyId: string;
      siteId: string | null;
      type: BckBackupType;
      scope: BckBackupScope;
      status: BckBackupStatus;
      restorable: boolean;
      locked: boolean;
      label: string | null;
      sizeBytes: bigint | null;
      checksumSha256: string | null;
      artifactPath: string | null;
      destinationId: string | null;
      errorCode: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      manifest?: {
        applicationVersion: string;
        schemaVersion: string;
        checksumAlgorithm: string;
        scopeMetadataJson?: Prisma.JsonValue;
      } | null;
    },
  ) {
    return {
      id: row.id,
      companyId: row.companyId,
      siteId: row.siteId,
      type: row.type,
      scope: row.scope,
      status: row.status,
      restorable: row.restorable,
      locked: row.locked,
      label: row.label,
      sizeBytes: row.sizeBytes !== null ? Number(row.sizeBytes) : null,
      checksumSha256: row.checksumSha256,
      artifactPath: row.artifactPath,
      destinationId: row.destinationId,
      errorCode: row.errorCode,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      manifest: row.manifest
        ? {
            applicationVersion: row.manifest.applicationVersion,
            schemaVersion: row.manifest.schemaVersion,
            checksumAlgorithm: row.manifest.checksumAlgorithm,
          }
        : null,
    };
  }
}

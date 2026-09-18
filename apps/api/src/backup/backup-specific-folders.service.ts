import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import {
  BckBackupScope,
  BckBackupStatus,
  BckBackupType,
  BckJobStatus,
  SetLevel,
} from '@prisma/client';
import { createReadStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
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
  type BackupSettingKey,
} from '../settings/settings.constants';
import { JobEnqueueService } from '../thunder-core/jobs/job-enqueue.service';
import {
  THUNDER_JOB_TYPES,
  thunderWorkersEnabled,
} from '../thunder-core/thunder.constants';
import {
  BACKUP_ERROR_CODES,
  type SpecificFolderDestinationMode,
} from './backup.constants';
import { BackupException } from './backup.exception';
import { scanSpecificFolders } from './backup-folder-scan';
import {
  assertReadableDirectory,
  businessFolderTemplates,
  ensureCompanySandbox,
  listSandboxDirectories,
  localDiskArtifactFromCwd,
  normalizeLocalSubpath,
  resolveSandboxRelative,
} from './backup-path-security';
import { bindBackupSpecificFoldersRunner } from './backup-specific-folders.runner';
import { sha256File, writeStreamingTarGz } from './backup-zip.util';
import { BackupService } from './backup.service';

type JsonArray = unknown[];

@Injectable()
export class BackupSpecificFoldersService implements OnModuleInit {
  private readonly logger = new Logger(BackupSpecificFoldersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly backup: BackupService,
    @Optional() private readonly jobs?: JobEnqueueService,
  ) {}

  onModuleInit(): void {
    bindBackupSpecificFoldersRunner(async (companyId, backupId, opts) =>
      this.executeJob(companyId, backupId, opts),
    );
  }

  async getConfig(companyId: string) {
    const enabled = await this.readBoolean(
      companyId,
      'backup.specificFolders.enabled',
    );
    return {
      enabled,
      defaultSelection: await this.readStringArray(
        companyId,
        'backup.specificFolders.defaultSelection',
      ),
      allowUserSelection: await this.readBoolean(
        companyId,
        'backup.specificFolders.allowUserSelection',
      ),
      followSymlinks: await this.readBoolean(
        companyId,
        'backup.specificFolders.followSymlinks',
      ),
      includePatterns: await this.readStringArray(
        companyId,
        'backup.specificFolders.includePatterns',
      ),
      excludePatterns: await this.readStringArray(
        companyId,
        'backup.specificFolders.excludePatterns',
      ),
      maxSize: await this.readNumber(
        companyId,
        'backup.specificFolders.maxSize',
      ),
      verifyAfterBackup: await this.readBoolean(
        companyId,
        'backup.specificFolders.verifyAfterBackup',
      ),
      auto: {
        enabled: await this.readBoolean(
          companyId,
          'backup.specificFolders.auto.enabled',
        ),
        hourTunis: await this.readNumber(
          companyId,
          'backup.specificFolders.auto.hourTunis',
        ),
      },
      destinations: {
        DOWNLOAD: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowDownload',
          ),
          supported: true,
        },
        LOCAL_DISK: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowLocalDisk',
          ),
          supported: true,
        },
        EXTERNAL_DISK: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowExternalDisk',
          ),
          supported: false,
        },
        NAS: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowNAS',
          ),
          supported: false,
        },
        NETWORK_SHARE: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowNetworkShare',
          ),
          supported: false,
        },
        OBJECT_STORAGE: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowObjectStorage',
          ),
          supported: false,
        },
        REMOTE_SERVER: {
          allowed: await this.readBoolean(
            companyId,
            'backup.destination.allowRemoteServer',
          ),
          supported: false,
        },
      },
      sandboxRootHint: `data/company-files/${companyId}/`,
      businessFolderTemplates: [...businessFolderTemplates()],
      backupTypeSupported: ['FULL'] as const,
      backupTypeUnsupported: ['INCREMENTAL', 'DIFFERENTIAL'] as const,
      encryptionSupported: false,
    };
  }

  async listRoots(companyId: string, parentRelative = '') {
    await this.assertFeatureEnabled(companyId);
    await ensureCompanySandbox(companyId);
    const dirs = await listSandboxDirectories(companyId, parentRelative);
    return {
      companyId,
      parent: parentRelative || '',
      directories: dirs,
    };
  }

  async validateFolders(
    companyId: string,
    folders: string[],
  ): Promise<{
    folders: Array<{
      relativePath: string;
      ok: boolean;
      code?: string;
      message?: string;
    }>;
  }> {
    await this.assertFeatureEnabled(companyId);
    const follow = await this.readBoolean(
      companyId,
      'backup.specificFolders.followSymlinks',
    );
    const results = [];
    for (const folder of folders) {
      try {
        const resolved = resolveSandboxRelative(companyId, folder);
        const access = await assertReadableDirectory(resolved, {
          followSymlinks: follow,
        });
        if (!access.exists) {
          results.push({
            relativePath: resolved.relativePath || folder,
            ok: false,
            code: BACKUP_ERROR_CODES.PATH_NOT_FOUND,
            message: 'Folder not found in company sandbox',
          });
        } else if (!access.isDirectory || !access.readable) {
          results.push({
            relativePath: resolved.relativePath || folder,
            ok: false,
            code: BACKUP_ERROR_CODES.PATH_FORBIDDEN,
            message: 'Folder not readable',
          });
        } else {
          results.push({
            relativePath: resolved.relativePath || '.',
            ok: true,
          });
        }
      } catch (error) {
        const code =
          error && typeof error === 'object' && 'code' in error
            ? String((error as { code: string }).code)
            : 'PATH_FORBIDDEN';
        results.push({
          relativePath: folder,
          ok: false,
          code: `BCK.${code}`,
          message: error instanceof Error ? error.message : 'Invalid path',
        });
      }
    }
    return { folders: results };
  }

  async preview(input: {
    companyId: string;
    folders: string[];
    includePatterns?: string[];
    excludePatterns?: string[];
  }) {
    await this.assertFeatureEnabled(input.companyId);
    const follow = await this.readBoolean(
      input.companyId,
      'backup.specificFolders.followSymlinks',
    );
    const maxSize = await this.readNumber(
      input.companyId,
      'backup.specificFolders.maxSize',
    );
    const include =
      input.includePatterns ??
      (await this.readStringArray(
        input.companyId,
        'backup.specificFolders.includePatterns',
      ));
    const exclude =
      input.excludePatterns ??
      (await this.readStringArray(
        input.companyId,
        'backup.specificFolders.excludePatterns',
      ));
    try {
      const scan = await scanSpecificFolders({
        companyId: input.companyId,
        folders: input.folders,
        includePatterns: include,
        excludePatterns: exclude,
        followSymlinks: follow,
        maxSize,
      });
      return {
        filesIncluded: scan.filesIncluded,
        filesExcluded: scan.filesExcluded,
        totalSizeBytes: scan.totalSizeBytes,
        estimatedBackupSizeBytes: scan.totalSizeBytes,
        folders: scan.folders,
      };
    } catch (error) {
      this.mapScanError(error);
    }
  }

  async enqueueJob(input: {
    companyId: string;
    actorUserId?: string;
    label?: string;
    folders: string[];
    destinationMode: SpecificFolderDestinationMode;
    includePatterns?: string[];
    excludePatterns?: string[];
    verifyAfterBackup?: boolean;
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
    /** When true, skip allowUserSelection and use defaults only (auto). */
    scheduled?: boolean;
  }) {
    await this.assertFeatureEnabled(input.companyId);
    const config = await this.getConfig(input.companyId);

    if (
      input.destinationMode === 'DOWNLOAD' &&
      (!config.destinations.DOWNLOAD.allowed ||
        !config.destinations.DOWNLOAD.supported)
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.DESTINATION_DENIED,
        'DOWNLOAD destination not allowed.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (
      input.destinationMode === 'LOCAL_DISK' &&
      (!config.destinations.LOCAL_DISK.allowed ||
        !config.destinations.LOCAL_DISK.supported)
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.DESTINATION_DENIED,
        'LOCAL_DISK destination not allowed.',
        HttpStatus.FORBIDDEN,
      );
    }

    let folders = [...input.folders];
    if (!input.scheduled && !config.allowUserSelection) {
      folders = config.defaultSelection;
    }
    if (folders.length === 0) {
      folders = config.defaultSelection;
    }
    if (folders.length === 0) {
      throw new BackupException(
        BACKUP_ERROR_CODES.EMPTY_SELECTION,
        'No folders selected.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const validation = await this.validateFolders(input.companyId, folders);
    if (validation.folders.some((f) => !f.ok)) {
      throw new BackupException(
        BACKUP_ERROR_CODES.PATH_FORBIDDEN,
        'One or more folders failed validation.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const include =
      input.includePatterns ?? config.includePatterns;
    const exclude =
      input.excludePatterns ?? config.excludePatterns;
    const verify =
      input.verifyAfterBackup ?? config.verifyAfterBackup;

    const destination = await this.backupEnsureLocal(input.companyId);
    const label =
      input.label?.trim() ||
      `specific-folders-${new Date().toISOString().slice(0, 10)}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const backup = await tx.bckBackup.create({
        data: {
          companyId: input.companyId,
          siteId: input.siteId ?? null,
          type: BckBackupType.FULL,
          scope: BckBackupScope.SPECIFIC_FOLDERS,
          status: BckBackupStatus.QUEUED,
          restorable: false,
          label,
          destinationId: destination.id,
          createdByUserId: input.actorUserId ?? null,
        },
      });

      const job = await tx.bckJob.create({
        data: {
          companyId: input.companyId,
          backupId: backup.id,
          status: BckJobStatus.PENDING,
          progress: 0,
          attempts: 0,
        },
      });

      await tx.bckManifest.create({
        data: {
          backupId: backup.id,
          applicationVersion: process.env.npm_package_version ?? '0.0.0',
          schemaVersion: 'd313',
          moduleVersionsJson: {},
          scopeMetadataJson: {
            type: 'SPECIFIC_FOLDER',
            folders: validation.folders.map((f) => f.relativePath),
            includePatterns: include,
            excludePatterns: exclude,
            destinationMode: input.destinationMode,
            verifyAfterBackup: verify,
            followSymlinks: config.followSymlinks,
            encryption: false,
            compression: 'gzip',
            backupType: 'FULL',
          },
          checksumAlgorithm: 'sha256',
        },
      });

      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupSpecificFoldersCreate,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: backup.id,
        afterJson: {
          folders: validation.folders.map((f) => f.relativePath),
          destinationMode: input.destinationMode,
          jobId: job.id,
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
          backupId: backup.id,
          scope: 'SPECIFIC_FOLDERS',
        },
      });

      return { backup, job };
    });

    const idempotencyKey = `bck-sf-${created.backup.id}`;
    let thunderJobId: string | null = null;
    if (this.jobs) {
      try {
        const enqueued = await this.jobs.enqueue({
          jobType: THUNDER_JOB_TYPES.backupSpecificFoldersCreate,
          companyId: input.companyId,
          queue: 'ops',
          priority: 2,
          idempotencyKey,
          payload: {
            backupId: created.backup.id,
            companyId: input.companyId,
          },
          userId: input.actorUserId,
          correlationId: input.correlationId,
        });
        thunderJobId = enqueued.jobId ?? null;
        await this.prisma.bckJob.update({
          where: { id: created.job.id },
          data: { thunderJobId },
        });
      } catch (error) {
        this.logger.warn(
          `Thunder enqueue failed for specific-folders — running inline: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    // Domain execution: always ensure progress when workers are off / enqueue failed.
    if (!thunderWorkersEnabled() || !thunderJobId) {
      await this.executeJob(input.companyId, created.backup.id, {
        correlationId: input.correlationId,
      });
    }

    const fresh = await this.prisma.bckBackup.findFirstOrThrow({
      where: { id: created.backup.id },
      include: { jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    return {
      backupId: fresh.id,
      jobId: fresh.jobs[0]?.id ?? created.job.id,
      thunderJobId,
      status: fresh.status,
      destinationMode: input.destinationMode,
      label: fresh.label,
    };
  }

  async getJob(companyId: string, jobId: string) {
    const job = await this.prisma.bckJob.findFirst({
      where: { id: jobId, companyId },
      include: { backup: true },
    });
    if (!job) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Job not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      id: job.id,
      backupId: job.backupId,
      thunderJobId: job.thunderJobId,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      backupStatus: job.backup.status,
      downloadReady:
        job.backup.status === BckBackupStatus.VERIFIED &&
        Boolean(job.backup.artifactPath),
    };
  }

  async cancelJob(input: {
    companyId: string;
    jobId: string;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }) {
    const job = await this.prisma.bckJob.findFirst({
      where: { id: input.jobId, companyId: input.companyId },
      include: { backup: true },
    });
    if (!job) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Job not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (
      job.status !== BckJobStatus.PENDING &&
      job.backup.status !== BckBackupStatus.QUEUED &&
      job.backup.status !== BckBackupStatus.REQUESTED
    ) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        `Job cannot be cancelled (status=${job.status}).`,
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.bckJob.update({
        where: { id: job.id },
        data: {
          status: BckJobStatus.CANCELLED,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.bckBackup.update({
        where: { id: job.backupId },
        data: {
          status: BckBackupStatus.FAILED,
          errorCode: BACKUP_ERROR_CODES.STATE,
          errorMessage: 'Cancelled',
          completedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await this.auditService.append(tx, {
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        action: AUDIT_ACTIONS.backupSpecificFoldersCancel,
        entityType: AUDIT_ENTITY_TYPES.bckBackup,
        entityId: job.backupId,
        afterJson: { jobId: job.id, status: 'CANCELLED' },
        ip: input.ip,
        device: input.userAgent,
        correlationId: input.correlationId,
      });
    });

    return { id: job.id, status: 'CANCELLED' };
  }

  openDownloadStream(companyId: string, backupId: string) {
    return this.resolveDownload(companyId, backupId).then((meta) => ({
      ...meta,
      stream: createReadStream(meta.absolutePath),
    }));
  }

  async resolveDownload(companyId: string, backupId: string) {
    const backup = await this.prisma.bckBackup.findFirst({
      where: {
        id: backupId,
        companyId,
        deletedAt: null,
      },
      include: { manifest: true },
    });
    if (!backup) {
      throw new BackupException(
        BACKUP_ERROR_CODES.NOT_FOUND,
        'Backup not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (backup.scope !== BckBackupScope.SPECIFIC_FOLDERS) {
      throw new BackupException(
        BACKUP_ERROR_CODES.DESTINATION_DENIED,
        'Download is limited to business folder archives (SPECIFIC_FOLDERS). System CONFIGURATION/DATABASE dumps are not downloadable.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!backup.artifactPath) {
      throw new BackupException(
        BACKUP_ERROR_CODES.ARTIFACT_MISSING,
        'Download artifact not ready.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (backup.status !== BckBackupStatus.VERIFIED) {
      throw new BackupException(
        BACKUP_ERROR_CODES.STATE,
        'Backup not verified yet.',
        HttpStatus.CONFLICT,
      );
    }
    const absolutePath = join(process.cwd(), backup.artifactPath);
    const stamp = backup.completedAt?.toISOString().replace(/[:.]/g, '-') ??
      backup.id.slice(0, 8);
    return {
      absolutePath,
      filename: `AUTHORITY_BACKUP_${stamp}.tar.gz`,
      checksumSha256: backup.checksumSha256,
      sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : undefined,
    };
  }

  /** Worker entry — Thunder HOW or inline fallback. */
  async executeJob(
    companyId: string,
    backupId: string,
    opts?: { correlationId?: string },
  ) {
    const backup = await this.prisma.bckBackup.findFirst({
      where: { id: backupId, companyId, deletedAt: null },
      include: { manifest: true, jobs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!backup || backup.scope !== BckBackupScope.SPECIFIC_FOLDERS) {
      throw new Error('specific-folders backup not found');
    }
    if (backup.status === BckBackupStatus.VERIFIED) {
      return { backupId, status: 'VERIFIED', skipped: true };
    }

    const job = backup.jobs[0];
    const meta = (backup.manifest?.scopeMetadataJson ?? {}) as Record<
      string,
      unknown
    >;
    const folders = Array.isArray(meta.folders)
      ? (meta.folders as string[])
      : [];
    const include = Array.isArray(meta.includePatterns)
      ? (meta.includePatterns as string[])
      : [];
    const exclude = Array.isArray(meta.excludePatterns)
      ? (meta.excludePatterns as string[])
      : [];
    const verify = meta.verifyAfterBackup !== false;
    const follow = Boolean(meta.followSymlinks);
    const maxSize = await this.readNumber(
      companyId,
      'backup.specificFolders.maxSize',
    );

    try {
      if (job) {
        await this.prisma.bckJob.update({
          where: { id: job.id },
          data: {
            status: BckJobStatus.RUNNING,
            progress: 10,
            attempts: { increment: 1 },
            startedAt: new Date(),
          },
        });
      }
      await this.prisma.bckBackup.update({
        where: { id: backupId },
        data: {
          status: BckBackupStatus.RUNNING,
          startedAt: new Date(),
          version: { increment: 1 },
        },
      });

      const scan = await scanSpecificFolders({
        companyId,
        folders,
        includePatterns: include,
        excludePatterns: exclude,
        followSymlinks: follow,
        maxSize,
      });

      if (job) {
        await this.prisma.bckJob.update({
          where: { id: job.id },
          data: { progress: 40 },
        });
      }

      const localSubpath = await this.readLocalSubpath(companyId);
      const relArtifact = localDiskArtifactFromCwd(
        companyId,
        `${backupId}.tar.gz`,
        localSubpath,
      );
      const absArtifact = join(process.cwd(), relArtifact);
      await mkdir(dirname(absArtifact), { recursive: true });

      const written = await writeStreamingTarGz({
        files: scan.files,
        outputPath: absArtifact,
      });

      await this.prisma.bckBackup.update({
        where: { id: backupId },
        data: {
          status: BckBackupStatus.VERIFYING,
          artifactPath: relArtifact.replace(/\\/g, '/'),
          sizeBytes: BigInt(written.sizeBytes),
          checksumSha256: written.checksumSha256,
          version: { increment: 1 },
        },
      });

      if (job) {
        await this.prisma.bckJob.update({
          where: { id: job.id },
          data: { progress: 80 },
        });
      }

      let verified = true;
      if (verify) {
        const rehash = await sha256File(absArtifact);
        verified = rehash === written.checksumSha256;
      }

      if (!verified) {
        throw Object.assign(new Error('Checksum mismatch after write'), {
          code: 'INTEGRITY_FAILED',
        });
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.bckBackup.update({
          where: { id: backupId },
          data: {
            status: BckBackupStatus.VERIFIED,
            restorable: false,
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (job) {
          await tx.bckJob.update({
            where: { id: job.id },
            data: {
              status: BckJobStatus.SUCCEEDED,
              progress: 100,
              completedAt: new Date(),
              version: { increment: 1 },
            },
          });
        }
        if (backup.manifest) {
          await tx.bckManifest.update({
            where: { id: backup.manifest.id },
            data: {
              scopeMetadataJson: {
                ...meta,
                filesCount: scan.filesIncluded,
                filesExcluded: scan.filesExcluded,
                sizeBytes: written.sizeBytes,
                checksum: written.checksumSha256,
                verificationStatus: 'VERIFIED',
                compression: true,
              },
            },
          });
        }
        await this.outboxService.enqueue(tx, {
          companyId,
          aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
          aggregateId: backupId,
          eventType: OUTBOX_EVENT_TYPES.backupSpecificFoldersCompleted,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.backupSpecificFoldersCompleted,
            eventVersion: 1,
            backupId,
            filesCount: scan.filesIncluded,
            sizeBytes: written.sizeBytes,
            correlationId: opts?.correlationId,
          },
        });
      });

      this.logger.log(
        `specific-folders backup verified company=${companyId} id=${backupId} files=${scan.filesIncluded}`,
      );

      return {
        backupId,
        status: 'VERIFIED',
        filesCount: scan.filesIncluded,
        sizeBytes: written.sizeBytes,
        checksumSha256: written.checksumSha256,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed';
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: string }).code)
          : BACKUP_ERROR_CODES.DUMP_FAILED;

      await this.prisma.$transaction(async (tx) => {
        await tx.bckBackup.update({
          where: { id: backupId },
          data: {
            status: BckBackupStatus.FAILED,
            errorCode: code.startsWith('BCK.') ? code : `BCK.${code}`,
            errorMessage: message.slice(0, 500),
            completedAt: new Date(),
            version: { increment: 1 },
          },
        });
        if (job) {
          await tx.bckJob.update({
            where: { id: job.id },
            data: {
              status: BckJobStatus.FAILED,
              errorCode: code,
              errorMessage: message.slice(0, 500),
              completedAt: new Date(),
              version: { increment: 1 },
            },
          });
        }
        await this.outboxService.enqueue(tx, {
          companyId,
          aggregateType: AUDIT_ENTITY_TYPES.bckBackup,
          aggregateId: backupId,
          eventType: OUTBOX_EVENT_TYPES.backupSpecificFoldersFailed,
          payloadJson: {
            eventType: OUTBOX_EVENT_TYPES.backupSpecificFoldersFailed,
            eventVersion: 1,
            backupId,
            errorCode: code,
          },
        });
      });
      throw error;
    }
  }

  /** Scheduled auto create using defaultSelection. */
  async runScheduled(companyId: string, opts?: { correlationId?: string }) {
    const enabled = await this.readBoolean(
      companyId,
      'backup.specificFolders.auto.enabled',
    );
    if (!enabled) {
      throw new Error('specificFolders.auto disabled');
    }
    const featureOn = await this.readBoolean(
      companyId,
      'backup.specificFolders.enabled',
    );
    if (!featureOn) {
      throw new Error('specificFolders feature disabled');
    }
    const defaults = await this.readStringArray(
      companyId,
      'backup.specificFolders.defaultSelection',
    );
    return this.enqueueJob({
      companyId,
      folders: defaults,
      destinationMode: 'LOCAL_DISK',
      scheduled: true,
      correlationId: opts?.correlationId,
    });
  }

  private async backupEnsureLocal(companyId: string) {
    // Reuse BackupService destination helper via listDestinations side effect.
    const list = await this.backup.listDestinations(companyId);
    const dest = list.destinations[0];
    if (!dest) {
      throw new BackupException(
        BACKUP_ERROR_CODES.DEST_UNAVAILABLE,
        'No LOCAL_FS destination.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return dest;
  }

  private async assertFeatureEnabled(companyId: string) {
    const on = await this.readBoolean(
      companyId,
      'backup.specificFolders.enabled',
    );
    if (!on) {
      throw new BackupException(
        BACKUP_ERROR_CODES.FEATURE_DISABLED,
        'Specific folder backup is disabled. Enable in Préférences → Sauvegarde.',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private mapScanError(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code: string }).code);
      if (code === 'MAX_SIZE_EXCEEDED') {
        throw new BackupException(
          BACKUP_ERROR_CODES.MAX_SIZE_EXCEEDED,
          error instanceof Error ? error.message : 'Max size exceeded',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (code === 'PATH_NOT_FOUND') {
        throw new BackupException(
          BACKUP_ERROR_CODES.PATH_NOT_FOUND,
          error instanceof Error ? error.message : 'Not found',
          HttpStatus.NOT_FOUND,
        );
      }
      if (code === 'PATH_TRAVERSAL' || code === 'PATH_FORBIDDEN') {
        throw new BackupException(
          BACKUP_ERROR_CODES.PATH_FORBIDDEN,
          error instanceof Error ? error.message : 'Forbidden path',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    throw error;
  }

  private async readLocalSubpath(companyId: string): Promise<string> {
    const key = 'backup.destination.localSubpath' as BackupSettingKey;
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

  private async readBoolean(
    companyId: string,
    key: BackupSettingKey,
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

  private async readNumber(
    companyId: string,
    key: BackupSettingKey,
  ): Promise<number> {
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
    return Number.isFinite(n) ? n : fallback;
  }

  private async readStringArray(
    companyId: string,
    key: BackupSettingKey,
  ): Promise<string[]> {
    const fallback = BACKUP_SETTING_DEFAULTS[key];
    const row = await this.prisma.setValue.findFirst({
      where: {
        defKey: key,
        scopeKey: buildScopeKey(SetLevel.COMPANY, { companyId }),
        deletedAt: null,
      },
    });
    const raw = row ? row.valueJson : fallback;
    if (!Array.isArray(raw)) return [];
    return (raw as JsonArray).filter((x): x is string => typeof x === 'string');
  }
}

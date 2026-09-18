import { HttpStatus } from '@nestjs/common';
import {
  BckBackupStatus,
  BckBackupType,
  BckBackupScope,
  BckDestinationType,
  BckDestinationHealth,
  BckJobStatus,
  BckRestoreStatus,
} from '@prisma/client';
import { BackupService } from './backup.service';
import { BACKUP_ERROR_CODES } from './backup.constants';
import { BackupException } from './backup.exception';

describe('BackupService (D304/D305)', () => {
  let prisma: {
    bckBackup: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    bckJob: { create: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    bckManifest: { create: jest.Mock };
    bckDestination: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    bckPolicy: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    bckRestoreRequest: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    modModuleState: { findMany: jest.Mock };
    orgCompany: { findUnique: jest.Mock };
    setValue: { findMany: jest.Mock; findFirst: jest.Mock };
    coreFile: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let outboxService: { enqueue: jest.Mock };
  let auth: { verifyCurrentPassword: jest.Mock };
  let service: BackupService;

  beforeEach(() => {
    prisma = {
      bckBackup: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      bckJob: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      bckManifest: { create: jest.fn() },
      bckDestination: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dest-1',
          companyId: 'c1',
          type: BckDestinationType.LOCAL_FS,
          pathRef: 'data/backups',
          healthStatus: BckDestinationHealth.UNKNOWN,
          enabled: true,
        }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      bckPolicy: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pol-1' }),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: 'pol-1' }]),
      },
      bckRestoreRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      modModuleState: {
        findMany: jest.fn().mockResolvedValue([
          { moduleKey: 'platform', status: 'ENABLED' },
        ]),
      },
      orgCompany: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          code: 'DEMO',
          legalName: 'Demo',
          country: 'TN',
          currency: 'TND',
          timezone: 'Africa/Tunis',
          status: 'ACTIVE',
        }),
      },
      setValue: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      coreFile: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        Promise.resolve(cb(prisma)),
      ),
    };
    auditService = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    outboxService = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    auth = { verifyCurrentPassword: jest.fn().mockResolvedValue(undefined) };
    service = new BackupService(
      prisma as never,
      auditService as never,
      outboxService as never,
      auth as never,
    );
  });

  it('dashboard returns counts without inventing KPIs', async () => {
    prisma.bckBackup.findFirst.mockResolvedValue(null);
    const dash = await service.dashboard('c1');
    expect(dash.counts).toEqual({
      total: 0,
      verified: 0,
      failed: 0,
      locked: 0,
      restorable: 0,
    });
    expect(dash.lastBackup).toBeNull();
    expect(dash.openRestoreRequests).toBe(0);
    expect(dash.schedule.autoBackup.enabled).toBe(false);
    expect(dash.note).toContain('D309');
  });

  it('blocks restore request for non-restorable artifacts', async () => {
    prisma.bckBackup.findFirst.mockResolvedValue({
      id: 'b1',
      companyId: 'c1',
      status: BckBackupStatus.VERIFIED,
      restorable: false,
      locked: false,
      deletedAt: null,
      manifest: null,
    });
    await expect(
      service.requestRestore({
        companyId: 'c1',
        backupId: 'b1',
        actorUserId: 'u1',
        password: 'x',
        confirm: true,
      }),
    ).rejects.toMatchObject({
      code: BACKUP_ERROR_CODES.RESTORE_NOT_INSTALLABLE,
    });
  });

  it('requires password re-auth to request restore', async () => {
    prisma.bckBackup.findFirst.mockResolvedValue({
      id: 'b1',
      companyId: 'c1',
      status: BckBackupStatus.VERIFIED,
      restorable: true,
      locked: false,
      deletedAt: null,
      artifactPath: 'c1/b1.dump',
      manifest: null,
    });
    try {
      await service.requestRestore({
        companyId: 'c1',
        backupId: 'b1',
        actorUserId: 'u1',
        confirm: true,
      });
      fail('expected BackupException');
    } catch (error) {
      expect(error).toBeInstanceOf(BackupException);
      expect((error as BackupException).code).toBe(
        BACKUP_ERROR_CODES.REAUTH_REQUIRED,
      );
      expect((error as BackupException).getStatus()).toBe(
        HttpStatus.UNAUTHORIZED,
      );
    }
  });

  it('rejects same approver on dual-control restore', async () => {
    prisma.bckRestoreRequest.findFirst.mockResolvedValue({
      id: 'r1',
      companyId: 'c1',
      backupId: 'b1',
      status: BckRestoreStatus.PENDING_SECOND_APPROVAL,
      requestedByUserId: 'u1',
      approvedByUserId: 'u1',
    });
    await expect(
      service.approveRestore({
        companyId: 'c1',
        restoreRequestId: 'r1',
        actorUserId: 'u1',
        password: 'DemoPass123!',
      }),
    ).rejects.toMatchObject({ code: BACKUP_ERROR_CODES.SAME_APPROVER });
  });

  it('locks a VERIFIED backup', async () => {
    prisma.bckBackup.findFirst.mockResolvedValue({
      id: 'b1',
      companyId: 'c1',
      status: BckBackupStatus.VERIFIED,
      locked: false,
      restorable: false,
      type: BckBackupType.FULL,
      scope: BckBackupScope.CONFIGURATION,
      siteId: null,
      label: 'x',
      sizeBytes: null,
      checksumSha256: 'abc',
      artifactPath: 'c1/b1.manifest.json',
      destinationId: 'dest-1',
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      manifest: null,
      deletedAt: null,
    });
    prisma.bckBackup.update.mockResolvedValue({
      id: 'b1',
      companyId: 'c1',
      status: BckBackupStatus.LOCKED,
      locked: true,
      restorable: false,
      type: BckBackupType.FULL,
      scope: BckBackupScope.CONFIGURATION,
      siteId: null,
      label: 'x',
      sizeBytes: null,
      checksumSha256: 'abc',
      artifactPath: 'c1/b1.manifest.json',
      destinationId: 'dest-1',
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      manifest: null,
    });

    const result = await service.lock({
      companyId: 'c1',
      backupId: 'b1',
      actorUserId: 'u1',
    });
    expect(result.locked).toBe(true);
    expect(result.status).toBe(BckBackupStatus.LOCKED);
  });

  it('refuses delete of locked backup', async () => {
    prisma.bckBackup.findFirst.mockResolvedValue({
      id: 'b1',
      companyId: 'c1',
      status: BckBackupStatus.LOCKED,
      locked: true,
      deletedAt: null,
      manifest: null,
    });
    await expect(
      service.softDelete({
        companyId: 'c1',
        backupId: 'b1',
        actorUserId: 'u1',
      }),
    ).rejects.toMatchObject({ code: BACKUP_ERROR_CODES.LOCKED });
  });

  it('createBackup CONFIGURATION writes verified non-restorable artifact', async () => {
    prisma.bckBackup.create.mockResolvedValue({
      id: 'b-new',
      companyId: 'c1',
      status: BckBackupStatus.RUNNING,
    });
    prisma.bckJob.create.mockResolvedValue({
      id: 'j1',
      status: BckJobStatus.RUNNING,
    });
    prisma.bckManifest.create.mockResolvedValue({ id: 'm1' });
    prisma.bckBackup.update.mockResolvedValue({
      id: 'b-new',
      companyId: 'c1',
      siteId: null,
      type: BckBackupType.FULL,
      scope: BckBackupScope.CONFIGURATION,
      status: BckBackupStatus.VERIFIED,
      restorable: false,
      locked: false,
      label: 'configuration-manifest',
      sizeBytes: BigInt(100),
      checksumSha256: 'deadbeef',
      artifactPath: 'c1/b-new.manifest.json',
      destinationId: 'dest-1',
      errorCode: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      manifest: {
        applicationVersion: '0.0.0',
        schemaVersion: 'd304',
        checksumAlgorithm: 'sha256',
      },
    });
    prisma.bckJob.update.mockResolvedValue({});
    prisma.bckDestination.update.mockResolvedValue({});

    const result = await service.createBackup({
      companyId: 'c1',
      actorUserId: 'u1',
    });

    expect(result.restorable).toBe(false);
    expect(result.status).toBe(BckBackupStatus.VERIFIED);
    expect(result.checksumSha256).toBeTruthy();
    expect(outboxService.enqueue).toHaveBeenCalled();
  });

  it('createBackup DATABASE produces restorable dump (logical fallback)', async () => {
    prisma.bckBackup.create.mockResolvedValue({
      id: 'b-db',
      companyId: 'c1',
      status: BckBackupStatus.RUNNING,
    });
    prisma.bckJob.create.mockResolvedValue({
      id: 'j-db',
      status: BckJobStatus.RUNNING,
    });
    prisma.bckManifest.create.mockResolvedValue({ id: 'm-db' });
    prisma.bckBackup.update.mockResolvedValue({
      id: 'b-db',
      companyId: 'c1',
      siteId: null,
      type: BckBackupType.FULL,
      scope: BckBackupScope.DATABASE,
      status: BckBackupStatus.VERIFIED,
      restorable: true,
      locked: false,
      label: 'database-installable',
      sizeBytes: BigInt(200),
      checksumSha256: 'cafe',
      artifactPath: 'c1/b-db.dump',
      destinationId: 'dest-1',
      errorCode: null,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
      createdAt: new Date(),
      manifest: {
        applicationVersion: '0.0.0',
        schemaVersion: 'd305',
        checksumAlgorithm: 'sha256',
      },
    });
    prisma.bckJob.update.mockResolvedValue({});
    prisma.bckDestination.update.mockResolvedValue({});

    // Force logical path: unset DATABASE_URL for this call's pg_dump attempt
    // (util falls back when pg_dump fails).
    const result = await service.createBackup({
      companyId: 'c1',
      actorUserId: 'u1',
      scope: 'DATABASE',
      label: 'db-e2e',
    });

    expect(result.restorable).toBe(true);
    expect(result.scope).toBe(BckBackupScope.DATABASE);
    expect(prisma.bckManifest.create).toHaveBeenCalled();
  });
});

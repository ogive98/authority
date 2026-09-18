import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

/**
 * Smoke D304–D310 Backup:
 * CONFIGURATION non-restorable · DATABASE restorable · restore reauth/dual-control
 * · dashboard schedule · cancel · destination health · autoBackup settings keys
 */
describe('Backup foundation D304–D310 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  jest.setTimeout(60_000);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginDemo() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    const demoUser = await prisma.iamUser.findUnique({
      where: { email: DEMO_EMAIL },
    });
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: company!.id })
      .expect(200);
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'backup',
        },
      },
      update: { status: 'ENABLED' },
      create: {
        companyId: company!.id,
        moduleKey: 'backup',
        status: 'ENABLED',
      },
    });
    for (const permissionKey of [
      'backup.view',
      'backup.create',
      'backup.verify',
      'backup.restore',
      'backup.manage_settings',
      'backup.specific_folder.view',
      'backup.specific_folder.create',
      'backup.specific_folder.configure',
      'backup.destination.download',
      'backup.destination.local_disk',
      'settings.company.write',
    ]) {
      const existing = await prisma.iamGrant.findFirst({
        where: {
          permissionKey,
          subjectType: 'USER',
          subjectId: demoUser!.id,
          companyId: company!.id,
          status: 'ACTIVE',
        },
      });
      if (!existing) {
        await prisma.iamGrant.create({
          data: {
            permissionKey,
            subjectType: 'USER',
            subjectId: demoUser!.id,
            companyId: company!.id,
            effect: 'ALLOW',
            status: 'ACTIVE',
          },
        });
      }
    }
    return { agent, companyId: company!.id, demoUserId: demoUser!.id };
  }

  (hasDatabase ? it : it.skip)(
    'CONFIGURATION: create → restore blocked; DATABASE: restorable + reauth gate',
    async () => {
      const { agent } = await loginDemo();

      const dash = await agent.get('/api/v1/backup/dashboard').expect(200);
      expect(dash.body.counts).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          verified: expect.any(Number),
          failed: expect.any(Number),
          locked: expect.any(Number),
          restorable: expect.any(Number),
        }),
      );

      const config = await agent
        .post('/api/v1/backup/backups')
        .send({ label: 'e2e-d304', scope: 'CONFIGURATION' })
        .expect(200);
      expect(config.body.restorable).toBe(false);
      expect(config.body.status).toBe('VERIFIED');

      const blocked = await agent
        .post(`/api/v1/backup/backups/${config.body.id}/restore`)
        .send({ confirm: true, password: DEMO_PASSWORD })
        .expect(403);
      expect(blocked.body.code).toBe('BCK.RESTORE_NOT_INSTALLABLE');

      const db = await agent
        .post('/api/v1/backup/backups')
        .send({ label: 'e2e-d305', scope: 'DATABASE' })
        .expect(200);
      expect(db.body.restorable).toBe(true);
      expect(db.body.status).toBe('VERIFIED');
      expect(db.body.scope).toBe('DATABASE');

      const needsAuth = await agent
        .post(`/api/v1/backup/backups/${db.body.id}/restore`)
        .send({ confirm: true })
        .expect(400);

      // Missing password fails validation or reauth.
      expect([400, 401]).toContain(needsAuth.status);

      const requested = await agent
        .post(`/api/v1/backup/backups/${db.body.id}/restore`)
        .send({ confirm: true, password: DEMO_PASSWORD })
        .expect(200);
      expect(requested.body.status).toBe('PENDING_SECOND_APPROVAL');
      expect(requested.body.dualControlRequired).toBe(true);

      const sameApprover = await agent
        .post(`/api/v1/backup/restore-requests/${requested.body.id}/approve`)
        .send({ password: DEMO_PASSWORD })
        .expect(409);
      expect(sameApprover.body.code).toBe('BCK.SAME_APPROVER');

      // Force DRY_VALIDATED to exercise D307 apply path without a second human.
      await prisma.bckRestoreRequest.update({
        where: { id: requested.body.id },
        data: {
          status: 'DRY_VALIDATED',
          dryValidatedAt: new Date(),
          secondApprovedByUserId: '00000000-0000-0000-0000-000000000099',
          secondApprovedAt: new Date(),
        },
      });

      const applied = await agent
        .post(`/api/v1/backup/restore-requests/${requested.body.id}/apply`)
        .send({ password: DEMO_PASSWORD, confirmPhrase: 'RESTORE' })
        .expect(200);
      expect(applied.body.applied).toBe(true);
      expect(applied.body.status).toBe('APPLIED');
      expect(applied.body.safetyBackupId).toBeTruthy();
      expect(applied.body.health.ok).toBe(true);

      const settings = await agent.get('/api/v1/settings/effective').expect(200);
      const settingKeys = (
        settings.body.settings as { key: string }[] | undefined
      )?.map((row) => row.key);
      expect(settingKeys).toEqual(
        expect.arrayContaining([
          'backup.enabled',
          'backup.restore.requireElevatedPermission',
          'backup.retention.enabled',
          'backup.schedule.hourTunis',
          'backup.restore.safetyBackup.required',
        ]),
      );

      const retention = await agent
        .post('/api/v1/backup/retention/run')
        .expect(200);
      expect(retention.body).toEqual(
        expect.objectContaining({
          companyId: expect.any(String),
          softDeleted: expect.any(Number),
          skippedLocked: expect.any(Number),
        }),
      );
    },
  );

  (hasDatabase ? it : it.skip)(
    'D308–D310: dashboard schedule · cancel pending · destination test · autoBackup keys',
    async () => {
      const { agent } = await loginDemo();

      const dash = await agent.get('/api/v1/backup/dashboard').expect(200);
      expect(dash.body.schedule).toEqual(
        expect.objectContaining({
          autoBackup: expect.objectContaining({
            enabled: expect.any(Boolean),
            hourTunis: expect.any(Number),
            timezone: 'Africa/Tunis',
          }),
          retention: expect.objectContaining({
            enabled: expect.any(Boolean),
            hourTunis: expect.any(Number),
            timezone: 'Africa/Tunis',
          }),
        }),
      );
      expect(dash.body.openRestoreRequests).toEqual(expect.any(Number));
      expect(dash.body.note).toMatch(/no invented/i);

      const db = await agent
        .post('/api/v1/backup/backups')
        .send({ label: 'e2e-d310-cancel', scope: 'DATABASE' })
        .expect(200);

      const pending = await agent
        .post(`/api/v1/backup/backups/${db.body.id}/restore`)
        .send({ confirm: true, password: DEMO_PASSWORD })
        .expect(200);
      expect(pending.body.status).toBe('PENDING_SECOND_APPROVAL');

      const cancelled = await agent
        .post(`/api/v1/backup/restore-requests/${pending.body.id}/cancel`)
        .expect(200);
      expect(cancelled.body.status).toBe('CANCELLED');

      const destinations = await agent
        .get('/api/v1/backup/destinations')
        .expect(200);
      const destId = (
        destinations.body.destinations as { id: string }[] | undefined
      )?.[0]?.id;
      expect(destId).toBeTruthy();

      const health = await agent
        .post(`/api/v1/backup/destinations/${destId}/test`)
        .expect(200);
      expect(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']).toContain(
        health.body.healthStatus,
      );

      const effective = await agent
        .get('/api/v1/backup/settings/effective')
        .expect(200);
      expect(effective.body).toEqual(
        expect.objectContaining({
          companyId: expect.any(String),
          settings: expect.any(Array),
        }),
      );
      const effectiveKeys = (
        effective.body.settings as { key: string }[]
      ).map((row) => row.key);
      expect(effectiveKeys).toEqual(
        expect.arrayContaining([
          'backup.autoBackup.enabled',
          'backup.autoBackup.hourTunis',
          'backup.autoBackup.scope',
        ]),
      );

      const settings = await agent.get('/api/v1/settings/effective').expect(200);
      const settingKeys = (
        settings.body.settings as { key: string }[] | undefined
      )?.map((row) => row.key);
      expect(settingKeys).toEqual(
        expect.arrayContaining([
          'backup.autoBackup.enabled',
          'backup.autoBackup.hourTunis',
          'backup.autoBackup.scope',
        ]),
      );
    },
  );

  (hasDatabase ? it : it.skip)(
    'D312: backup.view required — DENY wins over role ALLOW',
    async () => {
      const { agent, companyId, demoUserId } = await loginDemo();

      const deny = await prisma.iamGrant.create({
        data: {
          permissionKey: 'backup.view',
          subjectType: 'USER',
          subjectId: demoUserId,
          companyId,
          effect: 'DENY',
          status: 'ACTIVE',
        },
      });

      try {
        await agent.get('/api/v1/backup/dashboard').expect(403);
      } finally {
        await prisma.iamGrant.delete({ where: { id: deny.id } });
      }
    },
  );

  (hasDatabase ? it : it.skip)(
    'D313: specific folders config · validate · job · download',
    async () => {
      const { agent, companyId } = await loginDemo();

      await agent
        .put('/api/v1/settings')
        .send({
          key: 'backup.specificFolders.enabled',
          level: 'COMPANY',
          value: true,
        })
        .expect(200);

      const cfg = await agent
        .get('/api/v1/backup/specific-folders/config')
        .expect(200);
      expect(cfg.body.enabled).toBe(true);
      expect(cfg.body.destinations.NAS.supported).toBe(false);

      const sandbox = join(
        process.cwd(),
        'data',
        'company-files',
        companyId,
        'e2e-docs',
      );
      await mkdir(sandbox, { recursive: true });
      await writeFile(join(sandbox, 'note.txt'), 'd313-e2e', 'utf8');

      const validated = await agent
        .post('/api/v1/backup/specific-folders/validate')
        .send({ folders: ['e2e-docs'] })
        .expect(200);
      expect(validated.body.folders[0].ok).toBe(true);

      const traversal = await agent
        .post('/api/v1/backup/specific-folders/validate')
        .send({ folders: ['../outside'] })
        .expect(200);
      expect(traversal.body.folders[0].ok).toBe(false);

      const job = await agent
        .post('/api/v1/backup/specific-folders/jobs')
        .send({
          folders: ['e2e-docs'],
          destinationMode: 'DOWNLOAD',
          verifyAfterBackup: true,
        })
        .expect(200);
      expect(job.body.backupId).toBeTruthy();
      expect(job.body.status).toBe('VERIFIED');

      await agent
        .get(`/api/v1/backup/backups/${job.body.backupId}/download`)
        .expect(200);
    },
  );

  (hasDatabase ? it : it.skip)(
    'D314: company-files mkdir · local resolve · download system denied',
    async () => {
      const { agent, companyId } = await loginDemo();

      const listed = await agent.get('/api/v1/backup/company-files').expect(200);
      expect(listed.body.templates).toEqual(
        expect.arrayContaining(['comptabilite', 'finance', 'banque']),
      );

      const mkdir = await agent
        .post('/api/v1/backup/company-files/mkdir')
        .send({ name: `e2e-d314-${Date.now()}` })
        .expect(200);
      expect(mkdir.body.relativePath).toBeTruthy();

      await agent
        .post('/api/v1/backup/company-files/mkdir')
        .send({ name: '../escape' })
        .expect(400);

      await agent
        .put('/api/v1/settings')
        .send({
          key: 'backup.destination.localSubpath',
          level: 'COMPANY',
          value: 'e2e-archives',
        })
        .expect(200);

      const resolved = await agent
        .get('/api/v1/backup/destinations/local/resolve')
        .expect(200);
      expect(resolved.body.localSubpath).toBe('e2e-archives');
      expect(resolved.body.fromCwd).toContain(companyId);

      const localMk = await agent
        .post('/api/v1/backup/destinations/local/mkdir')
        .send({ name: 'batch1' })
        .expect(200);
      expect(localMk.body.relativePath).toBe('batch1');

      const created = await agent
        .post('/api/v1/backup/backups')
        .send({ scope: 'CONFIGURATION', label: 'd314-no-download' })
        .expect(200);

      await agent
        .get(`/api/v1/backup/backups/${created.body.id}/download`)
        .expect(403);
    },
  );
});

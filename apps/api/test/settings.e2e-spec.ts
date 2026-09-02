import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildScopeKey } from '../src/settings/settings.constants';
import { SetLevel } from '@prisma/client';
import {
  PERMISSION_ERROR_CODES,
  PERMISSION_KEYS,
} from '../src/permissions/permission.constants';
import { MODULE_ERROR_CODES } from '../src/modules-registry/modules.constants';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../src/audit/audit.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const LIMITED_EMAIL = 'limited@authority.local';
const LIMITED_PASSWORD = 'LimitedPass123!';

interface EffectiveResponse {
  companyId: string;
  settings: Array<{
    key: string;
    value: string;
    source: string;
  }>;
}

interface EffectiveSettingResponse {
  key: string;
  value: string;
  source: string;
}

interface CheckResponse {
  permissionKey: string;
  allowed: boolean;
}

interface ErrorResponse {
  code: string;
}

describe('Settings hierarchy (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

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

    if (hasDatabase) {
      await resetDemoSettings(prisma);
    }
  });

  async function resetDemoSettings(db: PrismaService): Promise<void> {
    const demo = await db.orgCompany.findUnique({ where: { code: 'DEMO' } });
    const demoUser = await db.iamUser.findUnique({
      where: { email: DEMO_EMAIL },
    });
    if (!demo || !demoUser) {
      return;
    }

    const scopeKey = buildScopeKey(SetLevel.USER, {
      companyId: demo.id,
      subjectId: demoUser.id,
    });

    await db.setValue.upsert({
      where: {
        defKey_scopeKey: {
          defKey: 'ui.theme',
          scopeKey,
        },
      },
      update: { valueJson: 'light', deletedAt: null },
      create: {
        defKey: 'ui.theme',
        level: SetLevel.USER,
        scopeKey,
        companyId: demo.id,
        valueJson: 'light',
      },
    });
  }

  afterEach(async () => {
    await app.close();
  });

  async function loginWithDemoContext() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    return { agent, companyId: demo!.id };
  }

  it('returns effective settings with hierarchy sources', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const res = await agent.get('/api/v1/settings/effective').expect(200);
    const body = res.body as EffectiveResponse;

    const theme = body.settings.find((row) => row.key === 'ui.theme');
    const density = body.settings.find((row) => row.key === 'ui.density');
    const locale = body.settings.find((row) => row.key === 'ui.locale');

    expect(theme).toMatchObject({ value: 'light', source: 'USER' });
    expect(density).toMatchObject({ value: 'compact', source: 'ROLE' });
    expect(locale).toMatchObject({ value: 'fr-TN', source: 'SYSTEM' });
  });

  it('updates a user preference without granting permissions', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();

    const updated = await agent
      .put('/api/v1/settings')
      .send({ key: 'ui.theme', value: 'dark' })
      .expect(200);
    expect((updated.body as EffectiveSettingResponse).source).toBe('USER');
    expect((updated.body as EffectiveSettingResponse).value).toBe('dark');

    const manage = await agent
      .post('/api/v1/identity/permissions/check')
      .send({ permissionKey: PERMISSION_KEYS.identityUserManage })
      .expect(200);
    expect((manage.body as CheckResponse).allowed).toBe(false);

    const audit = await prisma.audEvent.findFirst({
      where: {
        action: AUDIT_ACTIONS.settingsValueUpdate,
        entityType: AUDIT_ENTITY_TYPES.setValue,
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();

    const outbox = await prisma.coreOutbox.findFirst({
      where: { eventType: OUTBOX_EVENT_TYPES.settingsValueUpdated },
      orderBy: { createdAt: 'desc' },
    });
    expect(outbox).not.toBeNull();
  });

  it('refuses effective settings without settings.self', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: LIMITED_EMAIL, password: LIMITED_PASSWORD })
      .expect(200);

    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const res = await agent.get('/api/v1/settings/effective').expect(403);
    expect((res.body as ErrorResponse).code).toBe(
      PERMISSION_ERROR_CODES.FORBIDDEN,
    );
  });

  it('returns MOD.DISABLED when the settings module is off', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(demo).not.toBeNull();

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: {
          companyId: demo!.id,
          moduleKey: 'settings',
        },
      },
      data: { status: 'DISABLED' },
    });

    try {
      const { agent } = await loginWithDemoContext();
      const res = await agent.get('/api/v1/settings/effective').expect(403);
      expect((res.body as ErrorResponse).code).toBe(
        MODULE_ERROR_CODES.DISABLED,
      );
    } finally {
      await prisma.modModuleState.update({
        where: {
          companyId_moduleKey: {
            companyId: demo!.id,
            moduleKey: 'settings',
          },
        },
        data: { status: 'ENABLED' },
      });
    }
  });
});

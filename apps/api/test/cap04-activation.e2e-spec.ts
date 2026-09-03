import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MODULE_ERROR_CODES } from '../src/modules-registry/modules.constants';
import { AUDIT_ACTIONS } from '../src/audit/audit.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

interface ErrorBody {
  code?: string;
  missingRequiredDependencies?: string[];
}

interface ActivationBody {
  moduleKey: string;
  status: string;
  changed: boolean;
}

describe('CAP-04 Super Admin module activation (e2e)', () => {
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
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginSuperAdmin() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/super-admin/v1/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);
    return agent;
  }

  async function loginDemo() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    return agent;
  }

  async function demoCompanyId(): Promise<string> {
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    if (!company) {
      throw new Error('DEMO missing');
    }
    return company.id;
  }

  async function resetBusinessModules(companyId: string): Promise<void> {
    for (const moduleKey of [
      'sales',
      'inventory',
      'customers',
      'master_data',
      'production',
      'payroll',
    ]) {
      await prisma.modModuleState.upsert({
        where: { companyId_moduleKey: { companyId, moduleKey } },
        update: { status: 'DISABLED' },
        create: { companyId, moduleKey, status: 'DISABLED' },
      });
    }
  }

  it('rejects tenant session on Super Admin module routes', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    const agent = await loginDemo();
    await agent
      .get(`/api/super-admin/v1/companies/${companyId}/modules`)
      .expect(401);
  });

  it('enable sales without deps → 409 MOD.DEPS_MISSING', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    await resetBusinessModules(companyId);
    const sa = await loginSuperAdmin();

    const res = await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/enable`)
      .expect(409);
    expect((res.body as ErrorBody).code).toBe(MODULE_ERROR_CODES.DEPS_MISSING);
    expect((res.body as ErrorBody).missingRequiredDependencies).toEqual(
      expect.arrayContaining(['customers', 'inventory']),
    );
  });

  it('enable deps then sales; ping works; disable idempotent; audit written', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    await resetBusinessModules(companyId);
    const sa = await loginSuperAdmin();

    for (const key of [
      'master_data',
      'customers',
      'inventory',
      'organization',
      'platform',
    ]) {
      await sa
        .post(
          `/api/super-admin/v1/companies/${companyId}/modules/${key}/enable`,
        )
        .expect(200);
    }

    const enabled = await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/enable`)
      .expect(200);
    expect(enabled.body as ActivationBody).toMatchObject({
      moduleKey: 'sales',
      status: 'ENABLED',
      changed: true,
    });

    const again = await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/enable`)
      .expect(200);
    expect((again.body as ActivationBody).changed).toBe(false);

    const demo = await loginDemo();
    await demo.get('/api/v1/sales/ping').expect(200);
    const caps = await demo.get('/api/v1/capabilities').expect(200);
    expect(
      (caps.body as { capabilities: { key: string }[] }).capabilities.some(
        (c) => c.key === 'sales.ping',
      ),
    ).toBe(true);

    const disabled = await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/disable`)
      .expect(200);
    expect(disabled.body as ActivationBody).toMatchObject({
      status: 'DISABLED',
      changed: true,
    });

    const disabledAgain = await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/disable`)
      .expect(200);
    expect((disabledAgain.body as ActivationBody).changed).toBe(false);

    await demo.get('/api/v1/sales/ping').expect(403);

    const audit = await prisma.audEvent.findFirst({
      where: {
        companyId,
        action: AUDIT_ACTIONS.moduleEnable,
      },
      orderBy: { occurredAt: 'desc' },
    });
    expect(audit).not.toBeNull();

    await resetBusinessModules(companyId);
  });

  it('disable inventory blocked while sales ENABLED unless force', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    await resetBusinessModules(companyId);
    const sa = await loginSuperAdmin();

    for (const key of ['master_data', 'customers', 'inventory']) {
      await sa
        .post(
          `/api/super-admin/v1/companies/${companyId}/modules/${key}/enable`,
        )
        .expect(200);
    }
    await sa
      .post(`/api/super-admin/v1/companies/${companyId}/modules/sales/enable`)
      .expect(200);

    const blocked = await sa
      .post(
        `/api/super-admin/v1/companies/${companyId}/modules/inventory/disable`,
      )
      .expect(409);
    expect((blocked.body as ErrorBody).code).toBe(
      MODULE_ERROR_CODES.HAS_DEPENDENTS,
    );

    await sa
      .post(
        `/api/super-admin/v1/companies/${companyId}/modules/inventory/disable`,
      )
      .send({ force: true })
      .expect(200);

    await resetBusinessModules(companyId);
  });
});

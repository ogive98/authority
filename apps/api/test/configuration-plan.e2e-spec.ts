import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface PlanResponse {
  planId: string;
  status: string;
  lifecycle: string | null;
  publishAllowed: boolean;
  approvalRequired: boolean;
  applyVia: string;
  changes: Array<{
    key: string;
    ok: boolean;
    proposedValue: unknown;
    code: string | null;
  }>;
  projected: Array<{ key: string; value: unknown }> | null;
}

describe('Configuration plan persist/approve/apply (e2e)', () => {
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

  it('rejects unauthenticated plan', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/settings/configuration-plan')
      .send({ changes: [{ key: 'ui.theme', value: 'dark' }] })
      .expect(401);
  });

  it('validates ephemeral plan without applying', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();

    const before = await agent.get('/api/v1/settings/effective').expect(200);
    const themeBefore = (
      before.body as {
        settings: Array<{ key: string; value: unknown }>;
      }
    ).settings.find((row) => row.key === 'ui.theme');

    const planRes = await agent
      .post('/api/v1/settings/configuration-plan')
      .send({
        changes: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
        reason: 'D297 e2e',
      })
      .expect(200);

    const plan = planRes.body as PlanResponse;
    expect(plan.publishAllowed).toBe(false);
    expect(plan.lifecycle).toBeNull();
    expect(plan.applyVia).toBe('PUT /api/v1/settings');
    expect(plan.status).toBe('valid');

    const after = await agent.get('/api/v1/settings/effective').expect(200);
    const themeAfter = (
      after.body as {
        settings: Array<{ key: string; value: unknown }>;
      }
    ).settings.find((row) => row.key === 'ui.theme');
    expect(themeAfter?.value).toBe(themeBefore?.value);
  });

  it('persists low-risk draft and applies without separate approval', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId } = await loginWithDemoContext();

    const created = await agent
      .post('/api/v1/settings/configuration-plan')
      .send({
        changes: [{ key: 'ui.theme', value: 'dark', level: 'USER' }],
        reason: 'D298 persist',
        persist: true,
      })
      .expect(200);

    const plan = created.body as PlanResponse;
    expect(plan.lifecycle).toBe('DRAFT');
    expect(plan.publishAllowed).toBe(true);
    expect(plan.approvalRequired).toBe(false);

    const applied = await agent
      .post(`/api/v1/settings/configuration-plan/${plan.planId}/apply`)
      .expect(200);
    expect((applied.body as PlanResponse).lifecycle).toBe('APPLIED');

    const effective = await agent.get('/api/v1/settings/effective').expect(200);
    const theme = (
      effective.body as {
        settings: Array<{ key: string; value: unknown }>;
      }
    ).settings.find((row) => row.key === 'ui.theme');
    expect(theme?.value).toBe('dark');

    const row = await prisma.setConfigPlan.findFirst({
      where: { id: plan.planId, companyId },
    });
    expect(row?.status).toBe('APPLIED');
  });
});

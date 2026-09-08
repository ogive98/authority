import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

/**
 * Smoke ADV Repair deepen (D081):
 * login → scan L1 → plan SAFE → dry-run → execute → verify
 */
describe('Repair ERP ADV (e2e)', () => {
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
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: company!.id })
      .expect(200);
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'repair',
        },
      },
      update: { status: 'ENABLED' },
      create: {
        companyId: company!.id,
        moduleKey: 'repair',
        status: 'ENABLED',
      },
    });
    return { agent, companyId: company!.id };
  }

  (hasDatabase ? it : it.skip)(
    'scan L1 → plan REP-REDIS-001 → dry-run → execute SAFE → verify',
    async () => {
      const { agent } = await loginDemo();

      const dash = await agent.get('/api/v1/repair/dashboard').expect(200);
      expect(dash.body).toHaveProperty('pipeline');

      const scan = await agent
        .post('/api/v1/repair/health/scan')
        .send({ depth: 'L1', domains: ['L0', 'L1'] })
        .expect(200);
      expect(scan.body.scan.status).toBe('COMPLETED');
      expect(typeof scan.body.scan.findingCount).toBe('number');

      const plan = await agent
        .post('/api/v1/repair/repair/plan')
        .send({ scenarioId: 'REP-REDIS-001' })
        .expect(200);
      const executionId = plan.body.execution.id as string;
      expect(plan.body.execution.scenarioId).toBe('REP-REDIS-001');
      expect(plan.body.execution.risk).toBe('SAFE');

      const dry = await agent
        .post('/api/v1/repair/repair/execute')
        .send({ executionId, confirm: true, dryRun: true })
        .expect(200);
      expect(dry.body.execution.status).toBe('DRY_RUN');
      expect(dry.body.execution.resultJson?.wouldExecute).toBe(true);

      const exec = await agent
        .post('/api/v1/repair/repair/execute')
        .send({ executionId, confirm: true, password: DEMO_PASSWORD })
        .expect(200);
      expect(exec.body.execution.status).toBe('SUCCEEDED');
      expect(exec.body.execution.resultJson?.applied).toBe(true);
      expect(exec.body.execution.resultJson?.sideEffects).toBe(
        'technical-cache-only',
      );

      const verify = await agent
        .post('/api/v1/repair/verify')
        .send({ executionId })
        .expect(200);
      expect(verify.body.ok).toBe(true);
      expect(verify.body.detail?.mode).toBe('live');
    },
  );

  (hasDatabase ? it : it.skip)(
    'BLOCKED FLUSHALL cannot execute',
    async () => {
      const { agent } = await loginDemo();
      const plan = await agent
        .post('/api/v1/repair/repair/plan')
        .send({ scenarioId: 'REP-REDIS-FLUSHALL-BLOCKED' })
        .expect(200);
      const executionId = plan.body.execution.id as string;

      const res = await agent
        .post('/api/v1/repair/repair/execute')
        .send({ executionId, confirm: true, password: DEMO_PASSWORD })
        .expect(403);
      expect(res.body.code).toBe('REP.RISK_BLOCKED');
    },
  );

  (hasDatabase ? it : it.skip)(
    'live execute without password → REAUTH_REQUIRED',
    async () => {
      const { agent } = await loginDemo();
      const plan = await agent
        .post('/api/v1/repair/repair/plan')
        .send({ scenarioId: 'REP-REDIS-001' })
        .expect(200);
      const executionId = plan.body.execution.id as string;

      const res = await agent
        .post('/api/v1/repair/repair/execute')
        .send({ executionId, confirm: true })
        .expect(401);
      expect(res.body.code).toBe('REP.REAUTH_REQUIRED');
    },
  );

  (hasDatabase ? it : it.skip)('L2 scan runs structural checkers', async () => {
    const { agent } = await loginDemo();
    const scan = await agent
      .post('/api/v1/repair/health/scan')
      .send({ depth: 'L2', domains: [] })
      .expect(200);
    expect(scan.body.scan.status).toBe('COMPLETED');
    expect(scan.body.scan.findingCount).toBeGreaterThan(0);
  });
});

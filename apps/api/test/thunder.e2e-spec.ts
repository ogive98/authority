import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobProcessorHost } from '../src/thunder-core/jobs/job-processor.host';
import { THUNDER_ERROR_CODES } from '../src/thunder-core/thunder.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

interface HelloJobResponse {
  jobId: string;
  status: string;
  replayed: boolean;
}

interface JobStatusResponse {
  id: string;
  status: string;
  resultJson?: {
    executionCount?: number;
  };
}

interface ErrorResponse {
  code: string;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Thunder jobs (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const hasRedis = Boolean(process.env.REDIS_URL);

  jest.setTimeout(30_000);

  beforeEach(async () => {
    if (hasRedis) {
      process.env.THUNDER_WORKERS_ENABLED = 'true';
    }

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
    if (app) {
      await app.close();
    }
    delete process.env.THUNDER_WORKERS_ENABLED;
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

  async function waitForJobCompletion(
    agent: ReturnType<typeof request.agent>,
    jobId: string,
  ): Promise<JobStatusResponse> {
    return waitForJobStatus(agent, jobId, ['COMPLETED', 'FAILED']);
  }

  async function waitForJobStatus(
    agent: ReturnType<typeof request.agent>,
    jobId: string,
    statuses: string[],
  ): Promise<JobStatusResponse> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const res = await agent.get(`/api/v1/thunder/jobs/${jobId}`).expect(200);
      const body = res.body as JobStatusResponse;
      if (statuses.includes(body.status)) {
        return body;
      }
      await sleep(200);
    }

    throw new Error(`Job ${jobId} did not reach ${statuses.join('|')} in time`);
  }

  async function loginSuperAdmin() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/super-admin/v1/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);
    return agent;
  }

  it('enqueues thunder.hello.v1 with idempotent replay', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const idempotencyKey = `hello-${Date.now()}`;

    const first = await agent
      .post('/api/v1/thunder/jobs/hello')
      .send({ idempotencyKey, message: 'authority' })
      .expect(202);

    const firstBody = first.body as HelloJobResponse;
    expect(firstBody.replayed).toBe(false);
    expect(firstBody.jobId).toBeTruthy();

    const second = await agent
      .post('/api/v1/thunder/jobs/hello')
      .send({ idempotencyKey, message: 'authority' })
      .expect(202);

    const secondBody = second.body as HelloJobResponse;
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.jobId).toBe(firstBody.jobId);

    const completed = await waitForJobCompletion(agent, firstBody.jobId);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultJson?.executionCount).toBe(1);

    const rows = await prisma.thunderJob.findMany({
      where: { idempotencyKey },
    });
    expect(rows).toHaveLength(1);
  });

  it('rejects the same idempotency key with a different payload', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const idempotencyKey = `conflict-${Date.now()}`;

    await agent
      .post('/api/v1/thunder/jobs/hello')
      .send({ idempotencyKey, message: 'first' })
      .expect(202);

    const conflict = await agent
      .post('/api/v1/thunder/jobs/hello')
      .send({ idempotencyKey, message: 'second' })
      .expect(409);

    expect((conflict.body as ErrorResponse).code).toBe(
      THUNDER_ERROR_CODES.IDEMPOTENCY_CONFLICT,
    );
  });

  it('processes hello job inline via processor host', async () => {
    if (!hasDatabase) {
      return;
    }

    const processor = app.get(JobProcessorHost);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    const row = await prisma.thunderJob.create({
      data: {
        companyId: company!.id,
        jobType: 'thunder.hello.v1',
        queue: 'ops',
        idempotencyKey: `inline-${Date.now()}`,
        payloadHash: 'test',
        payloadJson: {
          message: 'inline',
          _context: {
            correlationId: 'corr-1',
            requestId: 'req-1',
            source: 'system',
            occurredAt: new Date().toISOString(),
          },
        },
        status: 'PENDING',
      },
    });

    await processor.processById(row.id);

    const updated = await prisma.thunderJob.findUnique({
      where: { id: row.id },
    });
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.resultJson).toMatchObject({ executionCount: 1 });
  });

  it('does not retry fatal validation jobs and records DLQ', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const idempotencyKey = `fatal-${Date.now()}`;

    const enqueued = await agent
      .post('/api/v1/thunder/jobs/fail-fatal')
      .send({ idempotencyKey })
      .expect(202);

    const jobId = (enqueued.body as HelloJobResponse).jobId;
    const failed = await waitForJobStatus(agent, jobId, ['FAILED']);
    expect(failed.status).toBe('FAILED');

    const row = await prisma.thunderJob.findUnique({ where: { id: jobId } });
    expect(row?.attempts).toBe(1);

    const dlq = await prisma.thunderDlqEntry.findFirst({
      where: { jobId },
    });
    expect(dlq).not.toBeNull();

    const saAgent = await loginSuperAdmin();
    const list = await saAgent
      .get('/api/super-admin/v1/thunder/dlq')
      .expect(200);
    const items = (list.body as { items: Array<{ jobId: string }> }).items;
    expect(items.some((entry) => entry.jobId === jobId)).toBe(true);
  });

  it('retries retryable jobs then completes without DLQ', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const idempotencyKey = `retry-${Date.now()}`;

    const enqueued = await agent
      .post('/api/v1/thunder/jobs/fail-retryable')
      .send({ idempotencyKey })
      .expect(202);

    const jobId = (enqueued.body as HelloJobResponse).jobId;
    const completed = await waitForJobStatus(agent, jobId, ['COMPLETED']);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultJson).toMatchObject({ recovered: true });

    const row = await prisma.thunderJob.findUnique({ where: { id: jobId } });
    expect(row?.attempts).toBe(3);

    const dlq = await prisma.thunderDlqEntry.findFirst({
      where: { jobId },
    });
    expect(dlq).toBeNull();
  });
});

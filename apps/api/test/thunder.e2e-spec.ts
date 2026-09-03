import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobProcessorHost } from '../src/thunder-core/jobs/job-processor.host';
import { JobEnqueueService } from '../src/thunder-core/jobs/job-enqueue.service';
import { EventConsumerHost } from '../src/thunder-core/events/event-consumer.host';
import { OutboxPublisherService } from '../src/thunder-core/events/outbox-publisher.service';
import { ResourceManagerService } from '../src/thunder-core/resources/resource-manager.service';
import { WatchdogService } from '../src/thunder-core/resources/watchdog.service';
import {
  THUNDER_DEPENDENCY_KEYS,
  THUNDER_ERROR_CODES,
  THUNDER_JOB_TYPES,
} from '../src/thunder-core/thunder.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

interface HelloJobResponse {
  jobId?: string;
  status: string;
  replayed: boolean;
  planC?: boolean;
  dependencyKey?: string;
  planCResult?: {
    mode?: string;
    dependencyKey?: string;
    message?: string;
  };
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
      process.env.THUNDER_EVENTS_ENABLED = 'true';
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
    delete process.env.THUNDER_EVENTS_ENABLED;
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

    const completed = await waitForJobCompletion(agent, firstBody.jobId!);
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

  it('fails timeout jobs without retrying', async () => {
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
        jobType: 'thunder.fail.timeout.v1',
        queue: 'ops',
        idempotencyKey: `timeout-${Date.now()}`,
        payloadHash: 'test',
        payloadJson: {
          _context: {
            correlationId: 'corr-timeout',
            requestId: 'req-timeout',
            source: 'system',
            occurredAt: new Date().toISOString(),
          },
        },
        status: 'PENDING',
      },
    });

    await expect(processor.processById(row.id)).rejects.toThrow(
      /timed out after 50ms/,
    );

    const updated = await prisma.thunderJob.findUnique({
      where: { id: row.id },
    });
    expect(updated?.attempts).toBe(1);
    const errorJson = updated?.errorJson as { message?: string } | null;
    expect(errorJson?.message).toContain('timed out');
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
    expect(jobId).toBeTruthy();
    const failed = await waitForJobStatus(agent, jobId!, ['FAILED']);
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
    expect(jobId).toBeTruthy();
    const completed = await waitForJobStatus(agent, jobId!, ['COMPLETED']);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultJson).toMatchObject({ recovered: true });

    const row = await prisma.thunderJob.findUnique({ where: { id: jobId } });
    expect(row?.attempts).toBe(3);

    const dlq = await prisma.thunderDlqEntry.findFirst({
      where: { jobId },
    });
    expect(dlq).toBeNull();
  });

  it('publishes outbox events and consumes them idempotently', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const publisher = app.get(OutboxPublisherService);
    const consumerHost = app.get(EventConsumerHost);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    const outbox = await prisma.coreOutbox.create({
      data: {
        companyId: company!.id,
        aggregateType: 'thunder_test',
        aggregateId: company!.id,
        eventType: 'thunder.test.event.v1',
        eventVersion: 1,
        payloadJson: {
          source: 'thunder',
          correlationId: `corr-${Date.now()}`,
          payload: { hello: 'event-bus' },
        },
      },
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await publisher.publishDue(50);
      const row = await prisma.coreOutbox.findUnique({
        where: { id: outbox.id },
      });
      if (row?.publishedAt) {
        break;
      }
      await sleep(100);
    }

    const publishedRow = await prisma.coreOutbox.findUnique({
      where: { id: outbox.id },
    });
    expect(publishedRow?.publishedAt).not.toBeNull();

    let processed: Array<{ consumer: string }> = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await consumerHost.pollOnce();
      processed = await prisma.coreProcessedEvent.findMany({
        where: { eventId: outbox.id },
        select: { consumer: true },
      });
      if (processed.length >= 2) {
        break;
      }
      await sleep(100);
    }

    expect(processed.map((row) => row.consumer).sort()).toEqual([
      'audit.tap',
      'thunder.echo',
    ]);

    const secondPass = await consumerHost.pollOnce();
    expect(secondPass).toBe(0);

    const processedAfterReplay = await prisma.coreProcessedEvent.findMany({
      where: { eventId: outbox.id },
    });
    expect(processedAfterReplay).toHaveLength(2);
  });

  it('fails fast with Plan C when the circuit breaker is open', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const saAgent = await loginSuperAdmin();
    const dependencyKey = THUNDER_DEPENDENCY_KEYS.externalApiStub;
    const idempotencyKey = `breaker-plan-c-${Date.now()}`;

    await saAgent
      .post(`/api/super-admin/v1/thunder/breakers/${dependencyKey}/open`)
      .expect(200);

    const degraded = await agent
      .post('/api/v1/thunder/jobs/breaker-guarded')
      .send({ idempotencyKey })
      .expect(202);

    const body = degraded.body as HelloJobResponse;
    expect(body.planC).toBe(true);
    expect(body.status).toBe('PLAN_C');
    expect(body.jobId).toBeUndefined();
    expect(body.planCResult).toMatchObject({
      mode: 'plan_c',
      dependencyKey,
    });

    const rows = await prisma.thunderJob.findMany({
      where: { idempotencyKey },
    });
    expect(rows).toHaveLength(0);

    await saAgent
      .post(`/api/super-admin/v1/thunder/breakers/${dependencyKey}/reset`)
      .expect(200);

    const enqueued = await agent
      .post('/api/v1/thunder/jobs/breaker-guarded')
      .send({ idempotencyKey: `breaker-normal-${Date.now()}` })
      .expect(202);

    const jobId = (enqueued.body as HelloJobResponse).jobId;
    expect(jobId).toBeTruthy();

    const completed = await waitForJobCompletion(agent, jobId!);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.resultJson).toMatchObject({
      ok: true,
      dependency: dependencyKey,
    });
  });

  it('pauses module-gated jobs when the module is disabled', async () => {
    if (!hasDatabase) {
      return;
    }

    const processor = app.get(JobProcessorHost);
    const enqueue = app.get(JobEnqueueService);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'inventory',
        },
      },
      update: { status: 'DISABLED' },
      create: {
        companyId: company!.id,
        moduleKey: 'inventory',
        status: 'DISABLED',
      },
    });

    await expect(
      enqueue.enqueue({
        jobType: THUNDER_JOB_TYPES.moduleGated,
        companyId: company!.id,
        queue: 'ops',
        idempotencyKey: `mod-off-enq-${Date.now()}`,
        payload: {},
      }),
    ).rejects.toMatchObject({
      code: THUNDER_ERROR_CODES.MODULE_DISABLED,
    });

    const row = await prisma.thunderJob.create({
      data: {
        companyId: company!.id,
        jobType: THUNDER_JOB_TYPES.moduleGated,
        queue: 'ops',
        idempotencyKey: `mod-off-proc-${Date.now()}`,
        payloadHash: 'test',
        payloadJson: {
          _context: {
            correlationId: 'corr-mod',
            requestId: 'req-mod',
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
    expect(updated?.status).toBe('PAUSED_BY_MODULE');
  });

  it('admits critical jobs while shedding import under P4 pressure', async () => {
    if (!hasDatabase) {
      return;
    }

    const enqueue = app.get(JobEnqueueService);
    const resources = app.get(ResourceManagerService);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });

    resources.setShedP4(true, 'e2e');

    try {
      await expect(
        enqueue.enqueue({
          jobType: THUNDER_JOB_TYPES.importBulk,
          companyId: company!.id,
          queue: 'import',
          idempotencyKey: `import-shed-${Date.now()}`,
          payload: {},
        }),
      ).rejects.toMatchObject({
        code: THUNDER_ERROR_CODES.SHED_P4,
      });

      if (hasRedis) {
        const { agent } = await loginWithDemoContext();
        const critical = await enqueue.enqueue({
          jobType: THUNDER_JOB_TYPES.criticalPing,
          companyId: company!.id,
          queue: 'critical',
          idempotencyKey: `critical-ok-${Date.now()}`,
          payload: {},
        });
        expect(critical.jobId).toBeTruthy();
        const completed = await waitForJobCompletion(agent, critical.jobId!);
        expect(completed.status).toBe('COMPLETED');
      } else {
        const processor = app.get(JobProcessorHost);
        const row = await prisma.thunderJob.create({
          data: {
            companyId: company!.id,
            jobType: THUNDER_JOB_TYPES.criticalPing,
            queue: 'critical',
            priority: 0,
            idempotencyKey: `critical-inline-${Date.now()}`,
            payloadHash: 'test',
            payloadJson: {
              _context: {
                correlationId: 'corr-crit',
                requestId: 'req-crit',
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
      }
    } finally {
      resources.setShedP4(false);
    }
  });

  it('watchdog requeues stalled idempotent jobs', async () => {
    if (!hasDatabase) {
      return;
    }

    const watchdog = app.get(WatchdogService);
    const enqueue = app.get(JobEnqueueService);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    const stale = new Date(Date.now() - 120_000);

    const row = await prisma.thunderJob.create({
      data: {
        companyId: company!.id,
        jobType: THUNDER_JOB_TYPES.hello,
        queue: 'ops',
        priority: 2,
        idempotencyKey: `watchdog-${Date.now()}`,
        payloadHash: 'test',
        payloadJson: {
          message: 'stalled',
          _context: {
            correlationId: 'corr-wd',
            requestId: 'req-wd',
            source: 'system',
            occurredAt: new Date().toISOString(),
          },
        },
        status: 'RUNNING',
        startedAt: stale,
        heartbeatAt: stale,
        attempts: 1,
        bullJobId: 'stale-bull',
      },
    });

    process.env.THUNDER_STALL_MS = '1000';

    try {
      if (!hasRedis) {
        const requeue = jest
          .spyOn(enqueue, 'requeueExisting')
          .mockResolvedValue(undefined);
        const handled = await watchdog.scanOnce();
        expect(handled).toBeGreaterThanOrEqual(1);
        expect(requeue).toHaveBeenCalledWith(
          expect.objectContaining({ jobId: row.id }),
        );
        requeue.mockRestore();
        const updated = await prisma.thunderJob.findUnique({
          where: { id: row.id },
        });
        expect(updated?.status).toBe('PENDING');
      } else {
        const handled = await watchdog.scanOnce();
        expect(handled).toBeGreaterThanOrEqual(1);
        const updated = await prisma.thunderJob.findUnique({
          where: { id: row.id },
        });
        // Worker may claim the requeued job immediately.
        expect(['PENDING', 'RUNNING', 'COMPLETED']).toContain(updated?.status);
        expect(updated?.bullJobId).not.toBe('stale-bull');
      }
    } finally {
      delete process.env.THUNDER_STALL_MS;
    }
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OutboxService } from '../src/audit/outbox.service';
import { JobEnqueueService } from '../src/thunder-core/jobs/job-enqueue.service';
import { OutboxPublisherService } from '../src/thunder-core/events/outbox-publisher.service';
import { THUNDER_ERROR_CODES } from '../src/thunder-core/thunder.constants';
import { ThunderException } from '../src/thunder-core/thunder.exception';
import { PayloadTooLargeError } from '../src/common/json-safety';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

/**
 * THU-HARD-04…06 e2e gates: metrics, outbox DLQ, payload size, tracing, SSE tick.
 */
describe('Thunder hardening (e2e)', () => {
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
    await app.close();
    delete process.env.THUNDER_PAYLOAD_MAX_BYTES;
    delete process.env.THUNDER_OUTBOX_MAX_PUBLISH_ATTEMPTS;
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

  async function loginSuperAdmin() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/super-admin/v1/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);
    return agent;
  }

  async function ensureMonitoringGrant(companyId: string) {
    const demoUser = await prisma.iamUser.findUnique({
      where: { email: DEMO_EMAIL },
    });
    const existingGrant = await prisma.iamGrant.findFirst({
      where: {
        permissionKey: 'system_monitoring.view',
        subjectType: 'USER',
        subjectId: demoUser!.id,
        companyId,
      },
    });
    if (!existingGrant) {
      await prisma.iamGrant.create({
        data: {
          permissionKey: 'system_monitoring.view',
          subjectType: 'USER',
          subjectId: demoUser!.id,
          companyId,
          effect: 'ALLOW',
        },
      });
    }
  }

  it('exposes Prometheus metrics text with thunder_* series', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId } = await loginWithDemoContext();
    await ensureMonitoringGrant(companyId);

    const res = await agent.get('/api/v1/thunder/metrics').expect(200);
    expect(String(res.headers['content-type'])).toContain('text/plain');
    expect(res.text).toContain('thunder_dlq_size');
    expect(res.text).toContain('thunder_outbox_dlq_size');
    expect(res.text).toContain('thunder_outbox_unpublished');
  });

  it('snapshot includes outboxDlq + tracing metadata', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId } = await loginWithDemoContext();
    await ensureMonitoringGrant(companyId);

    const res = await agent.get('/api/v1/thunder/monitor/snapshot').expect(200);
    const body = res.body as {
      events: { outboxDlq: number };
      tracing: { enabled: boolean; tracerName: string };
      metrics: { scrapePath: string };
    };
    expect(typeof body.events.outboxDlq).toBe('number');
    expect(body.tracing.tracerName).toBe('authority.thunder');
    expect(typeof body.tracing.enabled).toBe('boolean');
    expect(body.metrics.scrapePath).toBe('/api/v1/thunder/metrics');
  });

  it('rejects oversized job payloads with PAYLOAD_TOO_LARGE', async () => {
    if (!hasDatabase) {
      return;
    }

    const { companyId } = await loginWithDemoContext();
    const enqueue = app.get(JobEnqueueService);
    process.env.THUNDER_PAYLOAD_MAX_BYTES = '64';

    try {
      await enqueue.enqueue({
        jobType: 'thunder.hello.v1',
        companyId,
        queue: 'ops',
        idempotencyKey: `payload-big-${Date.now()}`,
        payload: { blob: 'x'.repeat(200) },
      });
      throw new Error('expected PAYLOAD_TOO_LARGE');
    } catch (error) {
      expect(error).toBeInstanceOf(ThunderException);
      expect((error as ThunderException).code).toBe(
        THUNDER_ERROR_CODES.PAYLOAD_TOO_LARGE,
      );
    }
  });

  it('rejects oversized outbox payloads', async () => {
    if (!hasDatabase) {
      return;
    }

    const outbox = app.get(OutboxService);
    process.env.THUNDER_PAYLOAD_MAX_BYTES = '64';

    await expect(
      prisma.$transaction(async (tx) =>
        outbox.enqueue(tx, {
          aggregateType: 'thunder_test',
          aggregateId: randomUUID(),
          eventType: 'thunder.test.payload.v1',
          payloadJson: { blob: 'y'.repeat(200) },
        }),
      ),
    ).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it('lists outbox DLQ via Super Admin after exhausted publishes', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const outbox = await prisma.coreOutbox.create({
      data: {
        aggregateType: 'thunder_test',
        aggregateId: randomUUID(),
        eventType: 'thunder.test.outbox-dlq.v1',
        eventVersion: 1,
        payloadJson: { password: 'should-redact', n: 1 },
        publishAttempts: 4,
      },
    });

    const publisher = app.get(OutboxPublisherService);
    const host = publisher as unknown as {
      publisherRedis: {
        xadd: (...args: unknown[]) => Promise<string>;
        disconnect?: () => void;
      } | null;
    };
    const previous = host.publisherRedis;
    host.publisherRedis = {
      xadd: async () => {
        throw new Error('forced xadd fail');
      },
      disconnect: () => undefined,
    };

    process.env.THUNDER_OUTBOX_MAX_PUBLISH_ATTEMPTS = '5';

    try {
      const published = await publisher.publishDue(5);
      expect(published).toBe(0);

      const gone = await prisma.coreOutbox.findUnique({
        where: { id: outbox.id },
      });
      expect(gone).toBeNull();

      const dlq = await prisma.coreOutboxDlq.findFirst({
        where: { outboxId: outbox.id },
      });
      expect(dlq).toBeTruthy();
      expect(dlq!.payloadJson).toMatchObject({
        password: '[REDACTED]',
        n: 1,
      });

      const sa = await loginSuperAdmin();
      const listed = await sa
        .get('/api/super-admin/v1/thunder/outbox-dlq')
        .expect(200);
      const body = listed.body as { items: Array<{ outboxId: string }> };
      expect(body.items.some((row) => row.outboxId === outbox.id)).toBe(true);
    } finally {
      host.publisherRedis = previous;
    }
  });

  it('streams at least one SSE monitor snapshot tick', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId } = await loginWithDemoContext();
    await ensureMonitoringGrant(companyId);

    let settled = false;
    const res = await agent
      .get('/api/v1/thunder/monitor/stream')
      .set('Accept', 'text/event-stream')
      .buffer(true)
      .parse((response, callback) => {
        let data = '';
        response.setEncoding('utf8');
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          try {
            response.destroy();
          } catch {
            // ignore
          }
          callback(null, data);
        };
        response.on('data', (chunk: string) => {
          data += chunk;
          if (data.includes('schemaVersion') || data.includes('"asOf"')) {
            finish();
          }
        });
        response.on('error', (err: Error) => {
          if (settled) {
            return;
          }
          settled = true;
          callback(err, data);
        });
        setTimeout(finish, 5_500);
      });

    expect(res.status).toBe(200);
    expect(String(res.headers['content-type'] ?? '')).toMatch(
      /text\/event-stream/,
    );
    expect(String(res.body)).toMatch(/schemaVersion|asOf|data:/);
  });
});

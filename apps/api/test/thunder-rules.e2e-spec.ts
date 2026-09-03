import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventConsumerHost } from '../src/thunder-core/events/event-consumer.host';
import { OutboxPublisherService } from '../src/thunder-core/events/outbox-publisher.service';
import { ruleNotifyLedger } from '../src/thunder-core/rules/rule-engine.service';
import { THUNDER_ERROR_CODES } from '../src/thunder-core/thunder.constants';
import { RedisService } from '../src/infrastructure/redis.service';
import { resetThunderEventStream } from './thunder-event-stream.util';

const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

describe('Thunder rules (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const hasRedis = Boolean(process.env.REDIS_URL);

  jest.setTimeout(45_000);

  beforeEach(async () => {
    ruleNotifyLedger.length = 0;
    if (hasRedis) {
      process.env.THUNDER_EVENTS_ENABLED = 'true';
      process.env.THUNDER_WORKERS_ENABLED = 'false';
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
    await prisma.thunderRuleDef.deleteMany({});
    if (hasRedis) {
      const redis = app.get(RedisService).createBullConnection();
      if (redis) {
        try {
          await resetThunderEventStream(redis);
        } finally {
          redis.disconnect();
        }
      }
    }
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.THUNDER_EVENTS_ENABLED;
    delete process.env.THUNDER_WORKERS_ENABLED;
    ruleNotifyLedger.length = 0;
  });

  async function loginSuperAdmin() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/super-admin/v1/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);
    return agent;
  }

  it('rejects cyclic rules at save', async () => {
    if (!hasDatabase) {
      return;
    }

    const sa = await loginSuperAdmin();
    await sa
      .post('/api/super-admin/v1/thunder/rules')
      .send({
        moduleKey: 'platform',
        name: 'a-to-b',
        eventPattern: 'event.a.v1',
        conditions: { '==': [1, 1] },
        actions: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.b.v1',
          },
        ],
      })
      .expect(201);

    const res = await sa
      .post('/api/super-admin/v1/thunder/rules')
      .send({
        moduleKey: 'platform',
        name: 'b-to-a',
        eventPattern: 'event.b.v1',
        conditions: { '==': [1, 1] },
        actions: [
          {
            type: 'enqueue_job',
            jobType: 'thunder.hello.v1',
            queue: 'ops',
            emitsEventType: 'event.a.v1',
          },
        ],
      })
      .expect(409);

    expect((res.body as { code: string }).code).toBe(
      THUNDER_ERROR_CODES.RULE_CYCLE_DETECTED,
    );
  });

  it('rejects non-whitelist actions', async () => {
    if (!hasDatabase) {
      return;
    }

    const sa = await loginSuperAdmin();
    const res = await sa
      .post('/api/super-admin/v1/thunder/rules')
      .send({
        moduleKey: 'platform',
        name: 'bad-action',
        eventPattern: 'event.x.v1',
        conditions: { '==': [1, 1] },
        actions: [{ type: 'call_module_command', command: 'x' }],
      })
      .expect(400);

    expect((res.body as { message?: string[] | string }).message).toBeTruthy();
  });

  it('notifies when a matching event is consumed and skips disabled modules', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'platform',
        },
      },
      update: { status: 'ENABLED' },
      create: {
        companyId: company!.id,
        moduleKey: 'platform',
        status: 'ENABLED',
      },
    });

    const sa = await loginSuperAdmin();
    await sa
      .post('/api/super-admin/v1/thunder/rules')
      .send({
        companyId: company!.id,
        moduleKey: 'platform',
        name: 'notify-on-echo',
        eventPattern: 'thunder.rule.test.v1',
        conditions: { '==': [{ var: 'payload.ok' }, true] },
        actions: [{ type: 'notify', templateId: 'rule.test', channel: 'ui' }],
        priority: 10,
        enabled: true,
      })
      .expect(201);

    const eventId = randomUUID();
    await prisma.coreOutbox.create({
      data: {
        id: eventId,
        companyId: company!.id,
        aggregateType: 'thunder',
        aggregateId: eventId,
        eventType: 'thunder.rule.test.v1',
        eventVersion: 1,
        payloadJson: {
          source: 'test',
          correlationId: `corr-rule-${Date.now()}`,
          payload: { ok: true },
        },
        headers: {
          correlationId: `corr-rule-${Date.now()}`,
          source: 'test',
        },
      },
    });

    const publisher = app.get(OutboxPublisherService);
    const consumer = app.get(EventConsumerHost);
    await publisher.publishDue(20);
    for (let i = 0; i < 10; i += 1) {
      await consumer.pollOnce();
      if (ruleNotifyLedger.some((n) => n.eventId === eventId)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(
      ruleNotifyLedger.some(
        (n) => n.eventId === eventId && n.templateId === 'rule.test',
      ),
    ).toBe(true);

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'platform',
        },
      },
      data: { status: 'DISABLED' },
    });

    ruleNotifyLedger.length = 0;
    const eventId2 = randomUUID();
    await prisma.coreOutbox.create({
      data: {
        id: eventId2,
        companyId: company!.id,
        aggregateType: 'thunder',
        aggregateId: eventId2,
        eventType: 'thunder.rule.test.v1',
        eventVersion: 1,
        payloadJson: {
          source: 'test',
          correlationId: `corr-rule-off-${Date.now()}`,
          payload: { ok: true },
        },
        headers: {
          correlationId: `corr-rule-off-${Date.now()}`,
          source: 'test',
        },
      },
    });
    await publisher.publishDue(20);
    await consumer.pollOnce();
    await consumer.pollOnce();
    expect(ruleNotifyLedger.some((n) => n.eventId === eventId2)).toBe(false);

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'platform',
        },
      },
      data: { status: 'ENABLED' },
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConsumerRegistryService } from '../src/thunder-core/events/consumer-registry.service';
import { EventConsumerHost } from '../src/thunder-core/events/event-consumer.host';
import { OutboxPublisherService } from '../src/thunder-core/events/outbox-publisher.service';
import {
  SIMULATED_MODULE_EVENTS,
  SIMULATED_MODULE_JOBS,
} from '../src/thunder-core/fixtures/simulated-modules/constants';
import {
  registerSimulatedModules,
  unregisterSimulatedModules,
} from '../src/thunder-core/fixtures/simulated-modules/register-simulated-modules';
import {
  resetSimulationLedger,
  simulationLedger,
} from '../src/thunder-core/fixtures/simulated-modules/simulation-ledger';
import { JobEnqueueService } from '../src/thunder-core/jobs/job-enqueue.service';
import { JobProcessorHost } from '../src/thunder-core/jobs/job-processor.host';
import { JobRegistryService } from '../src/thunder-core/jobs/job-registry.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Thunder module simulation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let moduleFixture: TestingModule;
  const hasDatabase = Boolean(process.env.DATABASE_URL);
  const hasRedis = Boolean(process.env.REDIS_URL);

  jest.setTimeout(45_000);

  beforeEach(async () => {
    resetSimulationLedger();

    if (hasRedis) {
      process.env.THUNDER_WORKERS_ENABLED = 'false';
      process.env.THUNDER_EVENTS_ENABLED = 'true';
    }

    moduleFixture = await Test.createTestingModule({
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

    registerSimulatedModules({
      prisma,
      jobRegistry: app.get(JobRegistryService),
      consumerRegistry: app.get(ConsumerRegistryService),
      jobEnqueue: app.get(JobEnqueueService),
    });

    await prisma.thunderJob.deleteMany({
      where: { jobType: SIMULATED_MODULE_JOBS.inventoryReserve },
    });
  });

  afterEach(async () => {
    if (moduleFixture) {
      unregisterSimulatedModules({
        jobRegistry: moduleFixture.get(JobRegistryService),
        consumerRegistry: moduleFixture.get(ConsumerRegistryService),
      });
    }
    if (app) {
      await app.close();
    }
    delete process.env.THUNDER_WORKERS_ENABLED;
    delete process.env.THUNDER_EVENTS_ENABLED;
    resetSimulationLedger();
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

  async function publishSalesOrderConfirmed(params: {
    companyId: string;
    orderId: string;
    correlationId: string;
    lines: Array<{ sku: string; qty: number }>;
  }) {
    return prisma.coreOutbox.create({
      data: {
        companyId: params.companyId,
        aggregateType: 'sales_order',
        aggregateId: params.orderId,
        eventType: SIMULATED_MODULE_EVENTS.salesOrderConfirmed,
        eventVersion: 1,
        payloadJson: {
          source: 'sales',
          correlationId: params.correlationId,
          payload: {
            orderId: params.orderId,
            lines: params.lines,
          },
        },
      },
    });
  }

  async function publishOutboxRow(outboxId: string): Promise<void> {
    const publisher = app.get(OutboxPublisherService);
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await publisher.publishDue(20);
      const published = await prisma.coreOutbox.findUnique({
        where: { id: outboxId },
      });
      if (published?.publishedAt) {
        return;
      }
      await sleep(100);
    }
    throw new Error(`Outbox row ${outboxId} was not published in time`);
  }

  async function drainInventoryJobsForEvent(
    salesOutboxId: string,
  ): Promise<void> {
    const processor = app.get(JobProcessorHost);
    const pending = await prisma.thunderJob.findMany({
      where: {
        jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
        idempotencyKey: `inventory.reserve.${salesOutboxId}`,
        status: { in: ['PENDING', 'RUNNING', 'FAILED'] },
      },
    });
    for (const job of pending) {
      await processor.processById(job.id);
    }
  }

  async function runEventBusUntil(
    salesOutboxId: string,
    predicate: () => boolean,
    maxAttempts = 30,
  ): Promise<void> {
    const publisher = app.get(OutboxPublisherService);
    const consumerHost = app.get(EventConsumerHost);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await consumerHost.pollOnce();
      await publisher.publishDue(20);
      await drainInventoryJobsForEvent(salesOutboxId);
      await consumerHost.pollOnce();
      if (predicate()) {
        return;
      }
      await sleep(200);
    }

    const scopedJobs = await prisma.thunderJob.findMany({
      where: {
        jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
        idempotencyKey: `inventory.reserve.${salesOutboxId}`,
      },
      select: { id: true, status: true, errorJson: true },
    });

    throw new Error(
      `Simulated module chain did not complete in time (reservations=${simulationLedger.reservations.length}, notifications=${simulationLedger.notifications.length}, scopedJobs=${JSON.stringify(scopedJobs)})`,
    );
  }

  it('chains sales event → inventory job → inventory event → notification without direct module calls', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { companyId } = await loginWithDemoContext();
    const orderId = randomUUID();
    const correlationId = `corr-module-chain-${Date.now()}`;

    const salesOutbox = await publishSalesOrderConfirmed({
      companyId,
      orderId,
      correlationId,
      lines: [{ sku: 'CHEESE-001', qty: 12 }],
    });

    await publishOutboxRow(salesOutbox.id);
    await runEventBusUntil(salesOutbox.id, () =>
      simulationLedger.notifications.some((entry) => entry.orderId === orderId),
    );

    const reservations = simulationLedger.reservations.filter(
      (entry) => entry.orderId === orderId,
    );
    expect(reservations).toHaveLength(1);
    expect(reservations[0]).toMatchObject({
      orderId,
      sku: 'CHEESE-001',
      qty: 12,
      correlationId,
    });

    expect(
      simulationLedger.notifications.filter((e) => e.orderId === orderId),
    ).toHaveLength(1);
    expect(
      simulationLedger.notifications.find((entry) => entry.orderId === orderId),
    ).toMatchObject({
      orderId,
      channel: 'stub',
      correlationId,
    });

    const reserveJobs = await prisma.thunderJob.findMany({
      where: {
        companyId,
        jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
        idempotencyKey: `inventory.reserve.${salesOutbox.id}`,
      },
    });
    expect(reserveJobs).toHaveLength(1);
    expect(reserveJobs[0]?.status).toBe('COMPLETED');

    const inventoryOutbox = await prisma.coreOutbox.findFirst({
      where: {
        companyId,
        eventType: SIMULATED_MODULE_EVENTS.inventoryStockReserved,
        aggregateId: orderId,
      },
    });
    expect(inventoryOutbox).not.toBeNull();

    const processedConsumers = await prisma.coreProcessedEvent.findMany({
      where: { eventId: salesOutbox.id },
      select: { consumer: true },
    });
    expect(processedConsumers.map((row) => row.consumer)).toContain(
      'inventory.reserveFromOrder',
    );
  });

  it('replays the same sales event without duplicating inventory side effects', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { companyId } = await loginWithDemoContext();
    const orderId = randomUUID();
    const correlationId = `corr-replay-${Date.now()}`;

    const salesOutbox = await publishSalesOrderConfirmed({
      companyId,
      orderId,
      correlationId,
      lines: [{ sku: 'CHEESE-002', qty: 3 }],
    });

    await publishOutboxRow(salesOutbox.id);
    await runEventBusUntil(salesOutbox.id, () =>
      simulationLedger.reservations.some((entry) => entry.orderId === orderId),
    );

    const consumerHost = app.get(EventConsumerHost);
    const secondPass = await consumerHost.pollOnce();
    expect(secondPass).toBe(0);

    expect(
      simulationLedger.reservations.filter(
        (entry) => entry.orderId === orderId,
      ),
    ).toHaveLength(1);

    const reserveJobs = await prisma.thunderJob.findMany({
      where: {
        companyId,
        jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
      },
    });
    expect(reserveJobs).toHaveLength(1);
    expect(reserveJobs[0]?.status).toBe('COMPLETED');
  });

  it('keeps correlationId across the simulated module boundary', async () => {
    if (!hasDatabase || !hasRedis) {
      return;
    }

    const { companyId } = await loginWithDemoContext();
    const orderId = randomUUID();
    const correlationId = `corr-boundary-${Date.now()}`;

    const salesOutbox = await publishSalesOrderConfirmed({
      companyId,
      orderId,
      correlationId,
      lines: [{ sku: 'CHEESE-003', qty: 1 }],
    });

    await publishOutboxRow(salesOutbox.id);
    await runEventBusUntil(salesOutbox.id, () =>
      simulationLedger.notifications.some((entry) => entry.orderId === orderId),
    );

    const reserveJob = await prisma.thunderJob.findFirst({
      where: {
        companyId,
        jobType: SIMULATED_MODULE_JOBS.inventoryReserve,
      },
    });
    expect(reserveJob).not.toBeNull();
    const payload = reserveJob?.payloadJson as {
      _context?: { correlationId?: string };
    };
    expect(payload._context?.correlationId).toBe(correlationId);
    expect(
      simulationLedger.reservations.find((entry) => entry.orderId === orderId)
        ?.correlationId,
    ).toBe(correlationId);
    expect(
      simulationLedger.notifications.find((entry) => entry.orderId === orderId)
        ?.correlationId,
    ).toBe(correlationId);
  });
});

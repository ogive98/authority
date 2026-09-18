import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface RegistrySummary {
  companyId: string | null;
  counts: { modules: number };
  engines: { authorityIndex: string; workflowEngine: string };
}

interface RegistryModulesResponse {
  modules: { id: string; canonicalId: string }[];
}

interface RegistryCapabilitiesResponse {
  capabilities: { key: string; canonicalId: string }[];
}

interface RegistryConfigurationResponse {
  configuration: { key: string; secret: boolean; value?: unknown }[];
}

interface RegistryEventsResponse {
  events: { eventType: string }[];
}

describe('Authority Index /core/registry (e2e)', () => {
  let app: INestApplication<App>;
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
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginAgent() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    return agent;
  }

  it('rejects unauthenticated discovery', async () => {
    await request(app.getHttpServer()).get('/api/v1/core/registry').expect(401);
  });

  it('discovers modules, capabilities and configuration without scanning code', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const summary = await agent.get('/api/v1/core/registry').expect(200);
    const summaryBody = summary.body as RegistrySummary;
    expect(summaryBody.engines.authorityIndex).toBe('live');
    expect(summaryBody.engines.workflowEngine).toBe('deferred');
    expect(summaryBody.counts.modules).toBeGreaterThanOrEqual(27);
    expect(summaryBody.companyId).toBeTruthy();

    const modules = await agent
      .get('/api/v1/core/registry/modules')
      .expect(200);
    const modulesBody = modules.body as RegistryModulesResponse;
    const sales = modulesBody.modules.find((row) => row.id === 'sales');
    expect(sales?.canonicalId).toBe('mod.sales');

    const caps = await agent
      .get('/api/v1/core/registry/capabilities')
      .expect(200);
    const capsBody = caps.body as RegistryCapabilitiesResponse;
    const confirm = capsBody.capabilities.find(
      (row) => row.key === 'sales.confirm',
    );
    expect(confirm?.canonicalId).toBe('cap.sales.confirm');

    const config = await agent
      .get('/api/v1/core/registry/configuration')
      .expect(200);
    const configBody = config.body as RegistryConfigurationResponse;
    const smtp = configBody.configuration.find(
      (row) => row.key === 'identity.smtp.pass',
    );
    expect(smtp?.secret).toBe(true);
    expect(smtp).not.toHaveProperty('value');

    const events = await agent.get('/api/v1/core/registry/events').expect(200);
    const eventsBody = events.body as RegistryEventsResponse;
    expect(
      eventsBody.events.some(
        (row) => row.eventType === 'sales.order.created.v1',
      ),
    ).toBe(true);
  });
});

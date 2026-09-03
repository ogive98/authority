import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MODULE_ERROR_CODES } from '../src/modules-registry/modules.constants';
import { FLAG_KEYS } from '../src/modules-registry/modules.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface ModulesResponse {
  modules: {
    key: string;
    status: string;
    name?: string;
    version?: string;
    apiVersion?: string;
    capabilityCount?: number;
  }[];
  flags: { key: string; enabled: boolean }[];
}

interface CapabilitiesResponse {
  capabilities: {
    key: string;
    moduleId: string;
    version: string;
  }[];
}

interface ErrorResponse {
  code: string;
}

describe('Modules registry (e2e)', () => {
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

  async function loginAgent() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    return agent;
  }

  it('lists kernel modules ENABLED and sales DISABLED', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/modules').expect(200);
    const body = res.body as ModulesResponse;

    expect(body.modules.find((m) => m.key === 'identity')?.status).toBe(
      'ENABLED',
    );
    expect(body.modules.find((m) => m.key === 'sales')?.status).toBe(
      'DISABLED',
    );
    expect(body.modules.find((m) => m.key === 'settings')?.status).toBe(
      'ENABLED',
    );
    expect(
      body.flags.find((f) => f.key === FLAG_KEYS.platformSearch)?.enabled,
    ).toBe(false);

    // CAP-01 additive metadata — contract { key, status } preserved
    const identity = body.modules.find((m) => m.key === 'identity');
    expect(identity?.name).toBe('Identity & Security');
    expect(identity?.version).toBe('1.0.0');
    expect(identity?.apiVersion).toBe('1');
    expect(identity?.capabilityCount).toBeGreaterThan(0);
  });

  it('lists effective capabilities without disabled module caps', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/capabilities').expect(200);
    const body = res.body as CapabilitiesResponse;
    const keys = body.capabilities.map((c) => c.key);

    expect(keys).toContain('platform.modules.read');
    expect(keys).toContain('identity.session.read');
    expect(keys).not.toContain('sales.ping');
    expect(keys).not.toContain('inventory.job.gated');
  });

  it('exposes sales.ping only after ModModuleState ENABLED', async () => {
    if (!hasDatabase) {
      return;
    }

    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(company).not.toBeNull();

    const agent = await loginAgent();
    const before = await agent.get('/api/v1/capabilities').expect(200);
    expect(
      (before.body as CapabilitiesResponse).capabilities.find(
        (c) => c.key === 'sales.ping',
      ),
    ).toBeUndefined();

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: {
          companyId: company!.id,
          moduleKey: 'sales',
        },
      },
      data: { status: 'ENABLED' },
    });

    try {
      const after = await agent.get('/api/v1/capabilities').expect(200);
      expect(
        (after.body as CapabilitiesResponse).capabilities.find(
          (c) => c.key === 'sales.ping',
        )?.moduleId,
      ).toBe('sales');
      // CAP-02: CapabilityGuard + sales.ping after module ENABLED
      const ping = await agent.get('/api/v1/sales/ping').expect(200);
      expect(ping.body).toEqual({
        status: 'ok',
        module: 'sales',
        capability: 'sales.ping',
      });
    } finally {
      await prisma.modModuleState.update({
        where: {
          companyId_moduleKey: {
            companyId: company!.id,
            moduleKey: 'sales',
          },
        },
        data: { status: 'DISABLED' },
      });
    }

    await agent.get('/api/v1/sales/ping').expect(403);
  });

  it('returns 403 MOD.DISABLED for a métier module API', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/sales/ping').expect(403);
    expect((res.body as ErrorResponse).code).toBe(MODULE_ERROR_CODES.DISABLED);
  });

  it('hides platform search when the flag is OFF', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const off = await agent.get('/api/v1/platform/search').expect(403);
    expect((off.body as ErrorResponse).code).toBe(MODULE_ERROR_CODES.FLAG_OFF);

    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(company).not.toBeNull();

    await prisma.modFlag.update({
      where: {
        companyId_flagKey: {
          companyId: company!.id,
          flagKey: FLAG_KEYS.platformSearch,
        },
      },
      data: { enabled: true },
    });

    try {
      const on = await agent.get('/api/v1/platform/search').expect(200);
      expect(on.body).toEqual({ hits: [] });
    } finally {
      await prisma.modFlag.update({
        where: {
          companyId_flagKey: {
            companyId: company!.id,
            flagKey: FLAG_KEYS.platformSearch,
          },
        },
        data: { enabled: false },
      });
    }

    await agent.get('/api/v1/platform/search').expect(403);
  });
});

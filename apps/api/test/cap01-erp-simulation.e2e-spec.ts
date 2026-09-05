/**
 * CAP-01 ERP-day simulations — find flaws before commit.
 * Assumes seeded DEMO company + Thunder/module surfaces exist.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ModuleCatalogService } from '../src/modules-registry/catalog/module-catalog.service';
import { MODULE_ERROR_CODES } from '../src/modules-registry/modules.constants';
import { TENANCY_HEADERS } from '../src/organization/organization.constants';
import { JobEnqueueService } from '../src/thunder-core/jobs/job-enqueue.service';
import { THUNDER_JOB_TYPES } from '../src/thunder-core/thunder.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface ModulesResponse {
  modules: {
    key: string;
    status: string;
    name?: string;
    capabilityCount?: number;
  }[];
}

interface CapabilitiesResponse {
  capabilities: {
    key: string;
    moduleId: string;
    permissionKey: string | null;
  }[];
}

interface ErrorBody {
  code?: string;
  statusCode?: number;
}

describe('CAP-01 ERP simulations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let catalog: ModuleCatalogService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  jest.setTimeout(45_000);

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
    catalog = app.get(ModuleCatalogService);
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

  async function demoCompanyId(): Promise<string> {
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    if (!company) {
      throw new Error('DEMO company missing — seed required');
    }
    return company.id;
  }

  async function setModuleStatus(
    companyId: string,
    moduleKey: string,
    status: 'ENABLED' | 'DISABLED',
  ): Promise<void> {
    await prisma.modModuleState.upsert({
      where: { companyId_moduleKey: { companyId, moduleKey } },
      update: { status },
      create: { companyId, moduleKey, status },
    });
  }

  it('SIM-01 boot: catalog = 14 modules, every dep resolves, no orphan caps', () => {
    if (!hasDatabase) {
      return;
    }

    const manifests = catalog.list();
    expect(manifests).toHaveLength(14);

    const ids = new Set(manifests.map((m) => m.id));
    const capKeys = new Set<string>();

    for (const m of manifests) {
      for (const dep of m.dependencies ?? []) {
        expect(ids.has(dep)).toBe(true);
      }
      for (const dep of m.optionalDependencies ?? []) {
        expect(ids.has(dep)).toBe(true);
      }
      for (const cap of m.capabilities) {
        expect(cap.moduleId).toBe(m.id);
        expect(capKeys.has(cap.key)).toBe(false);
        capKeys.add(cap.key);
        expect(catalog.getCapability(cap.key)?.moduleId).toBe(m.id);
      }
    }

    // sales declares customers+inventory — must be in the 11
    const sales = catalog.getByKey('sales');
    expect(sales?.dependencies).toEqual(
      expect.arrayContaining(['customers', 'inventory']),
    );
  });

  it('SIM-02 fromagerie morning: kernel caps on, métier caps off, sales API blocked', async () => {
    if (!hasDatabase) {
      return;
    }

    const companyId = await demoCompanyId();
    for (const key of [
      'sales',
      'inventory',
      'production',
      'payroll',
      'customers',
      'master_data',
    ]) {
      await setModuleStatus(companyId, key, 'DISABLED');
    }
    for (const key of [
      'platform',
      'identity',
      'organization',
      'settings',
      'monitoring',
    ]) {
      await setModuleStatus(companyId, key, 'ENABLED');
    }

    const agent = await loginAgent();
    const modulesRes = await agent.get('/api/v1/modules').expect(200);
    const modules = (modulesRes.body as ModulesResponse).modules;

    for (const key of [
      'platform',
      'identity',
      'organization',
      'settings',
      'monitoring',
    ]) {
      expect(modules.find((m) => m.key === key)?.status).toBe('ENABLED');
      expect(modules.find((m) => m.key === key)?.name).toBeTruthy();
    }
    for (const key of [
      'sales',
      'inventory',
      'production',
      'payroll',
      'customers',
      'master_data',
    ]) {
      expect(modules.find((m) => m.key === key)?.status).toBe('DISABLED');
    }

    const capsRes = await agent.get('/api/v1/capabilities').expect(200);
    const keys = (capsRes.body as CapabilitiesResponse).capabilities.map(
      (c) => c.key,
    );
    expect(keys).toContain('platform.modules.read');
    expect(keys).toContain('monitoring.snapshot.read');
    expect(keys).not.toContain('sales.ping');
    expect(keys).not.toContain('inventory.job.gated');
    expect(keys).not.toContain('customers.discover');

    await agent.get('/api/v1/sales/ping').expect(403);
  });

  it('SIM-03 enable inventory only: inventory caps appear; sales still absent', async () => {
    if (!hasDatabase) {
      return;
    }

    const companyId = await demoCompanyId();
    const agent = await loginAgent();

    await setModuleStatus(companyId, 'inventory', 'ENABLED');
    try {
      const caps = (await agent.get('/api/v1/capabilities').expect(200))
        .body as CapabilitiesResponse;
      const keys = caps.capabilities.map((c) => c.key);
      expect(keys).toContain('inventory.job.gated');
      expect(keys).not.toContain('sales.ping');

      // CAP-01 gap (expected until CAP-03/04): sales can be ENABLED without deps
      // Document current behavior — do not silently "fix" by inventing dep checks here.
      await setModuleStatus(companyId, 'sales', 'ENABLED');
      const afterSales = (await agent.get('/api/v1/capabilities').expect(200))
        .body as CapabilitiesResponse;
      expect(afterSales.capabilities.map((c) => c.key)).toContain('sales.ping');
      // customers still DISABLED → capability still listed (activation-only filter)
      expect(
        afterSales.capabilities.find((c) => c.key === 'customers.discover'),
      ).toBeUndefined();
    } finally {
      await setModuleStatus(companyId, 'inventory', 'DISABLED');
      await setModuleStatus(companyId, 'sales', 'DISABLED');
    }
  });

  it('SIM-04 disable platform: discovery APIs return MOD.DISABLED', async () => {
    if (!hasDatabase) {
      return;
    }

    const companyId = await demoCompanyId();
    const agent = await loginAgent();

    await setModuleStatus(companyId, 'platform', 'DISABLED');
    try {
      const modules = await agent.get('/api/v1/modules').expect(403);
      expect((modules.body as ErrorBody).code).toBe(
        MODULE_ERROR_CODES.DISABLED,
      );

      const caps = await agent.get('/api/v1/capabilities').expect(403);
      expect((caps.body as ErrorBody).code).toBe(MODULE_ERROR_CODES.DISABLED);
    } finally {
      await setModuleStatus(companyId, 'platform', 'ENABLED');
    }
  });

  it('SIM-05 cross-company: OTHER sales ENABLED must not leak into DEMO capabilities', async () => {
    if (!hasDatabase) {
      return;
    }

    const demoId = await demoCompanyId();
    const other = await prisma.orgCompany.findUnique({
      where: { code: 'OTHER' },
    });
    expect(other).not.toBeNull();

    await setModuleStatus(other!.id, 'sales', 'ENABLED');
    await setModuleStatus(other!.id, 'platform', 'ENABLED');
    try {
      const agent = await loginAgent();
      // Force DEMO context explicitly
      const caps = await agent
        .get('/api/v1/capabilities')
        .set(TENANCY_HEADERS.companyId, demoId)
        .expect(200);
      expect(
        (caps.body as CapabilitiesResponse).capabilities.find(
          (c) => c.key === 'sales.ping',
        ),
      ).toBeUndefined();

      // Spoof OTHER company id without assignment → ModuleGuard cannot resolve company → 403
      const spoof = await agent
        .get('/api/v1/capabilities')
        .set(TENANCY_HEADERS.companyId, other!.id)
        .expect(403);
      expect((spoof.body as ErrorBody).code).toBe(MODULE_ERROR_CODES.DISABLED);
    } finally {
      await prisma.modModuleState.deleteMany({
        where: { companyId: other!.id },
      });
    }
  });

  it('SIM-06 unauthenticated discovery is rejected', async () => {
    if (!hasDatabase) {
      return;
    }

    await request(app.getHttpServer()).get('/api/v1/capabilities').expect(401);
    await request(app.getHttpServer()).get('/api/v1/modules').expect(401);
  });

  it('SIM-07 orphan ModModuleState key: listed without catalog metadata; no fake caps', async () => {
    if (!hasDatabase) {
      return;
    }

    const companyId = await demoCompanyId();
    const orphanKey = `orphan_${randomUUID().slice(0, 8)}`;
    await setModuleStatus(companyId, orphanKey, 'ENABLED');
    try {
      const agent = await loginAgent();
      const modules = (await agent.get('/api/v1/modules').expect(200))
        .body as ModulesResponse;
      const orphan = modules.modules.find((m) => m.key === orphanKey);
      expect(orphan?.status).toBe('ENABLED');
      expect(orphan?.name).toBeUndefined();
      expect(orphan?.capabilityCount).toBeUndefined();

      const caps = (await agent.get('/api/v1/capabilities').expect(200))
        .body as CapabilitiesResponse;
      expect(caps.capabilities.every((c) => c.moduleId !== orphanKey)).toBe(
        true,
      );
    } finally {
      await prisma.modModuleState.delete({
        where: {
          companyId_moduleKey: { companyId, moduleKey: orphanKey },
        },
      });
    }
  });

  it('SIM-08 Thunder job gate still honors ModModuleState (inventory), independent of catalog metadata', async () => {
    if (!hasDatabase) {
      return;
    }

    const companyId = await demoCompanyId();
    const enqueue = app.get(JobEnqueueService);

    await setModuleStatus(companyId, 'inventory', 'DISABLED');
    await expect(
      enqueue.enqueue({
        jobType: THUNDER_JOB_TYPES.moduleGated,
        companyId,
        queue: 'ops',
        payload: { probe: 'cap01-sim' },
        idempotencyKey: `cap01-sim-off-${randomUUID()}`,
      }),
    ).rejects.toMatchObject({
      code: 'THUNDER.MODULE_DISABLED',
    });

    await setModuleStatus(companyId, 'inventory', 'ENABLED');
    try {
      const agent = await loginAgent();
      const caps = (await agent.get('/api/v1/capabilities').expect(200))
        .body as CapabilitiesResponse;
      expect(caps.capabilities.map((c) => c.key)).toContain(
        'inventory.job.gated',
      );

      const job = await enqueue.enqueue({
        jobType: THUNDER_JOB_TYPES.moduleGated,
        companyId,
        queue: 'ops',
        payload: { probe: 'cap01-sim-on' },
        idempotencyKey: `cap01-sim-on-${randomUUID()}`,
      });
      expect(job.jobId).toBeTruthy();
    } finally {
      await setModuleStatus(companyId, 'inventory', 'DISABLED');
    }
  });

  it('SIM-09 monitoring capability advertises permissionKey but CAP-01 does not enforce it yet', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const caps = (await agent.get('/api/v1/capabilities').expect(200))
      .body as CapabilitiesResponse;
    const monitoring = caps.capabilities.find(
      (c) => c.key === 'monitoring.snapshot.read',
    );
    expect(monitoring?.permissionKey).toBe('system_monitoring.view');
    // CAP-02 must gate on this — CAP-01 only exposes metadata
  });

  it('SIM-10 idempotent re-read: capabilities stable across two GETs same session', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const a = (await agent.get('/api/v1/capabilities').expect(200))
      .body as CapabilitiesResponse;
    const b = (await agent.get('/api/v1/capabilities').expect(200))
      .body as CapabilitiesResponse;
    expect(a.capabilities.map((c) => c.key).sort()).toEqual(
      b.capabilities.map((c) => c.key).sort(),
    );
  });
});

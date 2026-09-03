/**
 * CAP-02 simulations — resolve + CapabilityGuard vs RequireModule.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CapabilityResolverService } from '../src/modules-registry/catalog/capability-resolver.service';
import {
  CAPABILITY_ERROR_CODES,
  MODULE_ERROR_CODES,
} from '../src/modules-registry/modules.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface ErrorBody {
  code?: string;
}

describe('CAP-02 capability resolve (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let resolver: CapabilityResolverService;
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
    resolver = app.get(CapabilityResolverService);
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
      throw new Error('DEMO missing');
    }
    return company.id;
  }

  it('HTTP: ModuleGuard fires before CapabilityGuard (MOD.DISABLED)', async () => {
    if (!hasDatabase) {
      return;
    }
    const agent = await loginAgent();
    const res = await agent.get('/api/v1/sales/ping').expect(403);
    expect((res.body as ErrorBody).code).toBe(MODULE_ERROR_CODES.DISABLED);
  });

  it('resolver: sales.ping MODULE_DISABLED then allow after ENABLE', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    const user = await prisma.iamUser.findUnique({
      where: { email: DEMO_EMAIL },
    });
    expect(user).not.toBeNull();

    const off = await resolver.resolve('sales.ping', {
      companyId,
      userId: user!.id,
    });
    expect(off).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.MODULE_DISABLED,
    });

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: { companyId, moduleKey: 'sales' },
      },
      data: { status: 'ENABLED' },
    });
    try {
      const on = await resolver.resolve('sales.ping', {
        companyId,
        userId: user!.id,
      });
      expect(on).toEqual({
        allowed: true,
        capabilityKey: 'sales.ping',
        moduleId: 'sales',
      });

      const agent = await loginAgent();
      await agent.get('/api/v1/sales/ping').expect(200);
    } finally {
      await prisma.modModuleState.update({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'sales' },
        },
        data: { status: 'DISABLED' },
      });
    }
  });

  it('resolver: unknown capability', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    const result = await resolver.resolve('does.not.exist', { companyId });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.UNKNOWN,
    });
  });

  it('resolver: monitoring.snapshot.read requires permission (limited user denied)', async () => {
    if (!hasDatabase) {
      return;
    }
    const companyId = await demoCompanyId();
    const limited = await prisma.iamUser.findUnique({
      where: { email: 'limited@authority.local' },
    });
    const demo = await prisma.iamUser.findUnique({
      where: { email: DEMO_EMAIL },
    });
    expect(limited).not.toBeNull();
    expect(demo).not.toBeNull();

    const denied = await resolver.resolve('monitoring.snapshot.read', {
      companyId,
      userId: limited!.id,
    });
    expect(denied).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
    });

    const allowed = await resolver.resolve('monitoring.snapshot.read', {
      companyId,
      userId: demo!.id,
    });
    expect(allowed).toEqual({
      allowed: true,
      capabilityKey: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
    });
  });
});

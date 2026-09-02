import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  LICENSE_ERROR_CODES,
  LICENSE_CACHE_KEY,
} from '../src/license/license.constants';
import { signLicensePayload } from '../src/license/license-crypto';
import type { LicensePayload } from '../src/license/license.constants';
import { RedisService } from '../src/infrastructure/redis.service';
import { UserProvisioningService } from '../src/license/user-provisioning.service';
import { PERMISSION_ERROR_CODES } from '../src/permissions/permission.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const LIMITED_EMAIL = 'limited@authority.local';
const LIMITED_PASSWORD = 'LimitedPass123!';

interface ErrorResponse {
  code: string;
}

interface LicenseStatusResponse {
  status: string;
  limits: { maxSites: number };
  usage: { sites: number };
  companyId: string | null;
}

interface SiteResponse {
  id: string;
  code: string;
}

describe('License stub (e2e)', () => {
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

    if (hasDatabase) {
      await resetDemoLicense(prisma, app.get(RedisService));
    }
  });

  async function resetDemoLicense(
    db: PrismaService,
    redis: RedisService,
  ): Promise<void> {
    const demo = await db.orgCompany.findUnique({ where: { code: 'DEMO' } });
    if (demo) {
      await db.orgSite.deleteMany({
        where: {
          companyId: demo.id,
          code: { not: 'SFX' },
        },
      });
    }

    const payload: LicensePayload = {
      plan: 'demo',
      maxSites: 2,
      maxUsers: 50,
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: '2026-01-01T00:00:00.000Z',
    };
    const signature = signLicensePayload(payload);
    const row = await db.licCurrent.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (row) {
      await db.licCurrent.update({
        where: { id: row.id },
        data: {
          payloadJson: payload as unknown as Prisma.InputJsonValue,
          signature,
        },
      });
    }
    await redis.del(LICENSE_CACHE_KEY);
  }

  afterEach(async () => {
    await app.close();
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

  it('returns license status with site limits', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const res = await agent.get('/api/v1/license/status').expect(200);
    const body = res.body as LicenseStatusResponse;
    expect(body.status).toBe('active');
    expect(body.limits.maxSites).toBe(2);
    expect(body.companyId).toBeTruthy();
    expect(body.usage.sites).toBe(1);
  });

  it('scopes site usage to the active company context', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const withoutContext = await agent
      .get('/api/v1/license/status')
      .expect(200);
    const globalBody = withoutContext.body as LicenseStatusResponse;
    expect(globalBody.companyId).toBeNull();
    expect(globalBody.usage.sites).toBeGreaterThanOrEqual(2);

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const scoped = await agent.get('/api/v1/license/status').expect(200);
    const scopedBody = scoped.body as LicenseStatusResponse;
    expect(scopedBody.companyId).toBe(demo!.id);
    expect(scopedBody.usage.sites).toBe(1);
    expect(scopedBody.usage.sites).toBeLessThan(globalBody.usage.sites);
  });

  it('refuses site creation when the license site limit is reached', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId } = await loginWithDemoContext();
    const suffix = Date.now();

    const first = await agent
      .post(`/api/v1/organization/companies/${companyId}/sites`)
      .send({ code: `T${suffix}`, type: 'DEPOT' })
      .expect(201);
    const firstId = (first.body as SiteResponse).id;

    try {
      const blocked = await agent
        .post(`/api/v1/organization/companies/${companyId}/sites`)
        .send({ code: `U${suffix}`, type: 'DEPOT' })
        .expect(403);
      expect((blocked.body as ErrorResponse).code).toBe(
        LICENSE_ERROR_CODES.LIMIT_SITES,
      );
    } finally {
      await prisma.orgSite.deleteMany({
        where: { id: firstId },
      });
    }
  });

  it('rejects activation with an invalid signature', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const payload: LicensePayload = {
      plan: 'bad',
      maxSites: 1,
      maxUsers: 1,
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: new Date().toISOString(),
    };

    const res = await agent
      .post('/api/v1/license/activate')
      .send({
        payload,
        signature:
          'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      })
      .expect(400);
    expect((res.body as ErrorResponse).code).toBe(LICENSE_ERROR_CODES.INVALID);
  });

  it('activates a valid signed license', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const payload: LicensePayload = {
      plan: 'demo-activated',
      maxSites: 3,
      maxUsers: 25,
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: new Date().toISOString(),
    };
    const signature = signLicensePayload(payload);

    const res = await agent
      .post('/api/v1/license/activate')
      .send({ payload, signature })
      .expect(200);
    expect((res.body as LicenseStatusResponse).limits.maxSites).toBe(3);

    const history = await prisma.licHistory.findFirst({
      orderBy: { activatedAt: 'desc' },
    });
    expect(history).not.toBeNull();
  });

  it('refuses activation without license.manage', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: LIMITED_EMAIL, password: LIMITED_PASSWORD })
      .expect(200);

    const payload: LicensePayload = {
      plan: 'blocked',
      maxSites: 1,
      maxUsers: 1,
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: new Date().toISOString(),
    };

    const res = await agent
      .post('/api/v1/license/activate')
      .send({ payload, signature: signLicensePayload(payload) })
      .expect(403);

    expect((res.body as ErrorResponse).code).toBe(
      PERMISSION_ERROR_CODES.FORBIDDEN,
    );
  });

  it('refuses user provisioning when the license user limit is reached', async () => {
    if (!hasDatabase) {
      return;
    }

    const provisioning = app.get(UserProvisioningService);
    const activeUsers = await prisma.iamUser.count({
      where: { deletedAt: null, status: { not: 'DISABLED' } },
    });

    const payload: LicensePayload = {
      plan: 'demo-tight',
      maxSites: 2,
      maxUsers: activeUsers,
      expiresAt: '2027-12-31T23:59:59.000Z',
      issuedAt: new Date().toISOString(),
    };
    const signature = signLicensePayload(payload);
    const row = await prisma.licCurrent.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    expect(row).not.toBeNull();

    const previousPayload = row!.payloadJson as unknown as LicensePayload;
    const previousSignature = row!.signature;

    await prisma.licCurrent.update({
      where: { id: row!.id },
      data: {
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        signature,
      },
    });
    await app.get(RedisService).del(LICENSE_CACHE_KEY);

    try {
      await expect(provisioning.assertCanCreateUser()).rejects.toMatchObject({
        code: LICENSE_ERROR_CODES.LIMIT_USERS,
      });
    } finally {
      await prisma.licCurrent.update({
        where: { id: row!.id },
        data: {
          payloadJson: previousPayload as unknown as Prisma.InputJsonValue,
          signature: previousSignature,
        },
      });
      await app.get(RedisService).del(LICENSE_CACHE_KEY);
    }
  });
});

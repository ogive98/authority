import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ORG_ERROR_CODES } from '../src/organization/organization.constants';
import { PERMISSION_ERROR_CODES } from '../src/permissions/permission.constants';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../src/audit/audit.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const LIMITED_EMAIL = 'limited@authority.local';
const LIMITED_PASSWORD = 'LimitedPass123!';

interface SiteSummary {
  id: string;
  code: string;
}

interface ErrorResponse {
  code: string;
}

async function loginAgent(app: INestApplication<App>) {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/v1/identity/auth/login')
    .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
    .expect(200);
  return agent;
}

describe('Organization tenancy (e2e)', () => {
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

  it('lists only assigned companies', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent(app);
    const res = await agent.get('/api/v1/organization/companies').expect(200);
    const companies = res.body as SiteSummary[];

    expect(companies.some((c) => c.code === 'DEMO')).toBe(true);
    expect(companies.some((c) => c.code === 'OTHER')).toBe(false);
  });

  it('blocks IDOR on unassigned company', async () => {
    if (!hasDatabase) {
      return;
    }

    const other = await prisma.orgCompany.findUnique({
      where: { code: 'OTHER' },
    });
    expect(other).not.toBeNull();

    const agent = await loginAgent(app);
    const res = await agent
      .get(`/api/v1/organization/companies/${other!.id}`)
      .expect(403);

    expect((res.body as ErrorResponse).code).toBe(
      ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
    );
  });

  it('sets context and lists sites for assigned company', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(demo).not.toBeNull();

    const agent = await loginAgent(app);
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const sites = await agent
      .get(`/api/v1/organization/companies/${demo!.id}/sites`)
      .expect(200);

    expect(Array.isArray(sites.body)).toBe(true);
    expect((sites.body as SiteSummary[])[0]?.code).toBe('SFX');
  });

  it('rejects sites when URL company differs from tenancy context', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    const other = await prisma.orgCompany.findUnique({
      where: { code: 'OTHER' },
    });
    expect(demo).not.toBeNull();
    expect(other).not.toBeNull();

    const agent = await loginAgent(app);
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const res = await agent
      .get(`/api/v1/organization/companies/${other!.id}/sites`)
      .expect(403);

    expect((res.body as ErrorResponse).code).toBe(
      ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
    );
  });

  it('refuses site creation without org.site.write', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(demo).not.toBeNull();

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: LIMITED_EMAIL, password: LIMITED_PASSWORD })
      .expect(200);

    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const res = await agent
      .post(`/api/v1/organization/companies/${demo!.id}/sites`)
      .send({ code: `L${Date.now()}`, type: 'DEPOT' })
      .expect(403);

    expect((res.body as ErrorResponse).code).toBe(
      PERMISSION_ERROR_CODES.FORBIDDEN,
    );
  });

  it('writes aud_event and core_outbox when creating a site', async () => {
    if (!hasDatabase) {
      return;
    }

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(demo).not.toBeNull();

    const agent = await loginAgent(app);
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id })
      .expect(200);

    const code = `A${Date.now()}`;
    const created = await agent
      .post(`/api/v1/organization/companies/${demo!.id}/sites`)
      .send({ code, type: 'DEPOT' })
      .expect(201);
    const siteId = (created.body as SiteSummary).id;

    try {
      const audit = await prisma.audEvent.findFirst({
        where: {
          action: AUDIT_ACTIONS.organizationSiteCreate,
          entityType: AUDIT_ENTITY_TYPES.orgSite,
          entityId: siteId,
        },
        orderBy: { occurredAt: 'desc' },
      });
      expect(audit).not.toBeNull();

      const outbox = await prisma.coreOutbox.findFirst({
        where: {
          aggregateId: siteId,
          eventType: OUTBOX_EVENT_TYPES.organizationSiteCreated,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(outbox).not.toBeNull();
    } finally {
      await prisma.orgSite.deleteMany({ where: { id: siteId } });
    }
  });
});

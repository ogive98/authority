import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ORG_ERROR_CODES } from '../src/organization/organization.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface CompanySummary {
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
    const companies = res.body as CompanySummary[];

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
    expect((sites.body as CompanySummary[])[0]?.code).toBe('SFX');
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
});

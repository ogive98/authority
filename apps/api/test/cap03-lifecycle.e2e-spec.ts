import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface ModulesResponse {
  modules: {
    key: string;
    status: string;
    lifecycle?: string;
    health?: string;
    missingRequiredDependencies?: string[];
  }[];
}

describe('CAP-03 module lifecycle (e2e)', () => {
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

  it('lists process lifecycle READY and company health for kernel/métier', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/modules').expect(200);
    const body = res.body as ModulesResponse;

    const identity = body.modules.find((m) => m.key === 'identity');
    expect(identity?.status).toBe('ENABLED');
    expect(identity?.lifecycle).toBe('READY');
    expect(identity?.health).toBe('READY');

    const sales = body.modules.find((m) => m.key === 'sales');
    expect(sales?.status).toBe('DISABLED');
    expect(sales?.lifecycle).toBe('READY');
    expect(sales?.health).toBe('INACTIVE');
  });

  it('marks sales BLOCKED when ENABLED without required deps', async () => {
    if (!hasDatabase) {
      return;
    }

    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    expect(company).not.toBeNull();

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
      const agent = await loginAgent();
      const res = await agent.get('/api/v1/modules').expect(200);
      const sales = (res.body as ModulesResponse).modules.find(
        (m) => m.key === 'sales',
      );
      expect(sales?.status).toBe('ENABLED');
      expect(sales?.health).toBe('BLOCKED');
      expect(sales?.missingRequiredDependencies).toEqual(
        expect.arrayContaining(['customers', 'inventory']),
      );
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
  });
});

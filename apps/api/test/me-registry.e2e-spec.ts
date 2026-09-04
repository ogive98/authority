import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface RegistryResponse {
  companyId: string | null;
  modules: {
    key: string;
    name: string;
    features: { id: string; label: string; href: string; flagKey?: string }[];
  }[];
  flags: { key: string; enabled: boolean }[];
}

describe('Me registry (e2e)', () => {
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

  it('returns ENABLED modules only and excludes sales when DISABLED', async () => {
    if (!hasDatabase) return;

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/me/registry').expect(200);
    const body = res.body as RegistryResponse;

    expect(body.companyId).toBeTruthy();
    expect(body.modules.map((m) => m.key)).toContain('home');
    expect(body.modules.map((m) => m.key)).toContain('settings');
    expect(body.modules.map((m) => m.key)).not.toContain('sales');
    expect(body.modules.map((m) => m.key)).not.toContain('super-admin');
  });

  it('flag off removes Recherche feature; flag on restores after refetch', async () => {
    if (!hasDatabase) return;

    const agent = await loginAgent();
    const company = await prisma.orgCompany.findFirst({
      where: { deletedAt: null },
    });
    expect(company).toBeTruthy();

    await prisma.modFlag.upsert({
      where: {
        companyId_flagKey: {
          companyId: company!.id,
          flagKey: 'platform.search',
        },
      },
      update: { enabled: false },
      create: {
        companyId: company!.id,
        flagKey: 'platform.search',
        enabled: false,
      },
    });

    const off = (await agent.get('/api/v1/me/registry').expect(200))
      .body as RegistryResponse;
    const platformOff = off.modules.find((m) => m.key === 'platform');
    expect(
      platformOff?.features.some((f) => f.id === 'platform-search'),
    ).toBeFalsy();

    await prisma.modFlag.update({
      where: {
        companyId_flagKey: {
          companyId: company!.id,
          flagKey: 'platform.search',
        },
      },
      data: { enabled: true },
    });

    const on = (await agent.get('/api/v1/me/registry').expect(200))
      .body as RegistryResponse;
    const platformOn = on.modules.find((m) => m.key === 'platform');
    expect(platformOn?.features.some((f) => f.id === 'platform-search')).toBe(
      true,
    );

    // restore seed default
    await prisma.modFlag.update({
      where: {
        companyId_flagKey: {
          companyId: company!.id,
          flagKey: 'platform.search',
        },
      },
      data: { enabled: false },
    });
  });
});

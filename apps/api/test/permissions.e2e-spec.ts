import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSION_ERROR_CODES } from '../src/permissions/permission.constants';
import { PERMISSION_KEYS } from '../src/permissions/permission.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const LIMITED_EMAIL = 'limited@authority.local';
const LIMITED_PASSWORD = 'LimitedPass123!';

interface CheckResponse {
  permissionKey: string;
  allowed: boolean;
}

interface CatalogResponse {
  permissions: string[];
}

interface ErrorResponse {
  code: string;
}

describe('Permissions (e2e)', () => {
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

  it('returns the platform.* and identity.* catalogue', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const res = await agent
      .get('/api/v1/identity/permissions/catalog')
      .expect(200);
    const body = res.body as CatalogResponse;
    expect(body.permissions).toEqual(
      expect.arrayContaining([
        PERMISSION_KEYS.identitySelfRead,
        PERMISSION_KEYS.platformFileRead,
        PERMISSION_KEYS.orgSiteWrite,
        PERMISSION_KEYS.licenseManage,
        PERMISSION_KEYS.platformNumberingAllocate,
        PERMISSION_KEYS.settingsSelf,
        PERMISSION_KEYS.settingsCompanyWrite,
      ]),
    );
    expect(body.permissions.some((key) => key.includes('*'))).toBe(false);
  });

  it('matrix: demo can self.read, cannot user.manage, role grant is company-scoped', async () => {
    if (!hasDatabase) {
      return;
    }

    const demoCompany = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    const otherCompany = await prisma.orgCompany.findUnique({
      where: { code: 'OTHER' },
    });
    expect(demoCompany).not.toBeNull();
    expect(otherCompany).not.toBeNull();

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const self = await agent
      .post('/api/v1/identity/permissions/check')
      .send({ permissionKey: PERMISSION_KEYS.identitySelfRead })
      .expect(200);
    expect((self.body as CheckResponse).allowed).toBe(true);

    const manage = await agent
      .post('/api/v1/identity/permissions/check')
      .send({ permissionKey: PERMISSION_KEYS.identityUserManage })
      .expect(200);
    expect((manage.body as CheckResponse).allowed).toBe(false);

    const searchDemo = await agent
      .post('/api/v1/identity/permissions/check')
      .send({
        permissionKey: PERMISSION_KEYS.platformSearchUse,
        companyId: demoCompany!.id,
      })
      .expect(200);
    expect((searchDemo.body as CheckResponse).allowed).toBe(true);

    const searchOther = await agent
      .post('/api/v1/identity/permissions/check')
      .send({
        permissionKey: PERMISSION_KEYS.platformSearchUse,
        companyId: otherCompany!.id,
      })
      .expect(200);
    expect((searchOther.body as CheckResponse).allowed).toBe(false);
  });

  it('rejects /me without identity.self.read', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: LIMITED_EMAIL, password: LIMITED_PASSWORD })
      .expect(200);

    const res = await agent.get('/api/v1/identity/me').expect(403);
    expect((res.body as ErrorResponse).code).toBe(
      PERMISSION_ERROR_CODES.FORBIDDEN,
    );
  });
});

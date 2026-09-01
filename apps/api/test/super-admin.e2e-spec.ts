import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { IDENTITY_COOKIE_NAME } from '../src/identity/identity.constants';
import { SUPER_ADMIN_COOKIE_NAME } from '../src/super-admin/super-admin.constants';
import { SUPER_ADMIN_ERROR_CODES } from '../src/super-admin/super-admin.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SA_EMAIL = 'superadmin@authority.local';
const SA_PASSWORD = 'SuperAdminPass123!';

interface LoginResponse {
  user: { email: string };
  session: { id: string };
  realm?: string;
}

interface ErrorResponse {
  code: string;
}

function cookieHeader(res: { headers: { [key: string]: unknown } }): string {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.join(';');
  }
  return typeof raw === 'string' ? raw : '';
}

describe('Super Admin (e2e)', () => {
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

  it('rejects unauthenticated access to super-admin health', async () => {
    if (!hasDatabase) {
      return;
    }

    const res = await request(app.getHttpServer())
      .get('/api/super-admin/v1/health')
      .expect(401);

    expect((res.body as ErrorResponse).code).toBe(
      SUPER_ADMIN_ERROR_CODES.UNAUTHORIZED,
    );
  });

  it('rejects a business session on super-admin health', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const cookies = cookieHeader(login);
    expect(cookies).toContain(IDENTITY_COOKIE_NAME);
    expect(cookies).not.toContain(SUPER_ADMIN_COOKIE_NAME);

    const res = await agent.get('/api/super-admin/v1/health').expect(401);
    expect((res.body as ErrorResponse).code).toBe(
      SUPER_ADMIN_ERROR_CODES.UNAUTHORIZED,
    );
  });

  it('rejects a super-admin identity logging into the business realm from opening SA health', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);

    await agent.get('/api/super-admin/v1/health').expect(401);
  });

  it('logs into the super-admin realm with a distinct cookie', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/super-admin/v1/auth/login')
      .send({ email: SA_EMAIL, password: SA_PASSWORD })
      .expect(200);

    const body = login.body as LoginResponse;
    expect(body.user.email).toBe(SA_EMAIL);
    expect(body.realm).toBe('super_admin');

    const cookies = cookieHeader(login);
    expect(cookies).toContain(SUPER_ADMIN_COOKIE_NAME);
    expect(cookies).not.toContain(IDENTITY_COOKIE_NAME);

    const health = await agent.get('/api/super-admin/v1/health').expect(200);
    expect(health.body).toMatchObject({
      status: 'ok',
      realm: 'super_admin',
    });
  });

  it('rejects a business user on super-admin login', async () => {
    if (!hasDatabase) {
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/api/super-admin/v1/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(401);

    expect((res.body as ErrorResponse).code).toBe('IAM.INVALID_CREDENTIALS');
  });
});

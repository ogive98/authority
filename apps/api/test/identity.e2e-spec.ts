import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  IDENTITY_COOKIE_NAME,
  IDENTITY_ERROR_CODES,
} from '../src/identity/identity.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface LoginResponse {
  user: { email: string };
  session: { id: string };
}

interface MeResponse {
  email: string;
}

interface ErrorResponse {
  code: string;
}

describe('Identity (e2e)', () => {
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

  it('POST /api/v1/identity/auth/login succeeds for demo user', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    const res = await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const body = res.body as LoginResponse;
    expect(body.user.email).toBe(DEMO_EMAIL);
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toContain(IDENTITY_COOKIE_NAME);

    const me = await agent.get('/api/v1/identity/me').expect(200);
    expect((me.body as MeResponse).email).toBe(DEMO_EMAIL);
  });

  it('DELETE /api/v1/identity/sessions/:id revokes session', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const sessionId = (login.body as LoginResponse).session.id;

    await agent.delete(`/api/v1/identity/sessions/${sessionId}`).expect(204);
    await agent.get('/api/v1/identity/me').expect(401);
  });

  it('GET /api/v1/identity/me rejects env mismatch', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    await prisma.iamSession.update({
      where: { id: (login.body as LoginResponse).session.id },
      data: { env: 'demo-stale' },
    });

    const res = await agent.get('/api/v1/identity/me').expect(401);
    expect((res.body as ErrorResponse).code).toBe(
      IDENTITY_ERROR_CODES.ENV_MISMATCH,
    );
  });

  it('POST /api/v1/identity/auth/login rejects invalid credentials', async () => {
    if (!hasDatabase) {
      return;
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: 'wrong-password-xyz' })
      .expect(401);

    expect((res.body as ErrorResponse).code).toBe(
      IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
    );
  });
});

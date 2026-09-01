import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../src/audit/audit.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface MeResponse {
  id: string;
  displayName: string;
}

describe('Audit + outbox (e2e)', () => {
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

  it('writes aud_event and core_outbox in the same user update', async () => {
    if (!hasDatabase) {
      return;
    }

    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const before = await agent.get('/api/v1/identity/me').expect(200);
    const user = before.body as MeResponse;
    const originalName = user.displayName;
    const nextName = `Demo Operator ${Date.now()}`;

    try {
      const patched = await agent
        .patch('/api/v1/identity/me')
        .send({ displayName: nextName })
        .expect(200);
      expect((patched.body as MeResponse).displayName).toBe(nextName);

      const audit = await prisma.audEvent.findFirst({
        where: {
          actorUserId: user.id,
          action: AUDIT_ACTIONS.identityUserUpdate,
          entityType: AUDIT_ENTITY_TYPES.iamUser,
          entityId: user.id,
        },
        orderBy: { occurredAt: 'desc' },
      });
      expect(audit).not.toBeNull();

      const outbox = await prisma.coreOutbox.findFirst({
        where: {
          aggregateType: AUDIT_ENTITY_TYPES.iamUser,
          aggregateId: user.id,
          eventType: OUTBOX_EVENT_TYPES.identityUserUpdated,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(outbox).not.toBeNull();
      expect(outbox!.createdAt.getTime()).toBeGreaterThanOrEqual(
        audit!.occurredAt.getTime() - 2000,
      );
    } finally {
      await prisma.iamUser.update({
        where: { id: user.id },
        data: { displayName: originalName },
      });
    }
  });
});

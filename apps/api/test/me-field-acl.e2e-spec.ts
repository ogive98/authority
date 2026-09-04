import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  IamGrantEffect,
  IamGrantSubject,
  IamLifecycleStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { PERMISSION_KEYS } from '../src/permissions/permission.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface FieldAclResponse {
  companyId: string | null;
  fields: { key: string; permissionKey: string; visible: boolean }[];
}

describe('Me field ACL (e2e)', () => {
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

  it('masks wage for demo user without hr.wage.read', async () => {
    if (!hasDatabase) return;

    const agent = await loginAgent();
    const res = await agent.get('/api/v1/me/field-acl').expect(200);
    const body = res.body as FieldAclResponse;
    const wage = body.fields.find((f) => f.key === 'hr.wage');
    expect(wage).toMatchObject({
      permissionKey: PERMISSION_KEYS.hrWageRead,
      visible: false,
    });
  });

  it('reveals wage after ALLOW grant and masks again after revoke', async () => {
    if (!hasDatabase) return;

    const agent = await loginAgent();
    const user = await prisma.iamUser.findFirst({
      where: { email: DEMO_EMAIL },
    });
    expect(user).toBeTruthy();

    const grant = await prisma.iamGrant.create({
      data: {
        permissionKey: PERMISSION_KEYS.hrWageRead,
        subjectType: IamGrantSubject.USER,
        subjectId: user!.id,
        effect: IamGrantEffect.ALLOW,
        status: IamLifecycleStatus.ACTIVE,
      },
    });

    try {
      const allowed = await agent.get('/api/v1/me/field-acl').expect(200);
      expect(
        (allowed.body as FieldAclResponse).fields.find(
          (f) => f.key === 'hr.wage',
        )?.visible,
      ).toBe(true);
    } finally {
      await prisma.iamGrant.delete({ where: { id: grant.id } });
    }

    const denied = await agent.get('/api/v1/me/field-acl').expect(200);
    expect(
      (denied.body as FieldAclResponse).fields.find((f) => f.key === 'hr.wage')
        ?.visible,
    ).toBe(false);
  });
});

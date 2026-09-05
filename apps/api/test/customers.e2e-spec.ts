import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CUSTOMERS_ERROR_CODES } from '../src/customers/customers.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

type CustomerBody = {
  id: string;
  code: string;
  legalName: string;
  contacts?: { name: string }[];
  version: number;
};

describe('Customers V1a (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  jest.setTimeout(45_000);

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

  async function loginDemo() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: company!.id })
      .expect(200);
    return { agent, companyId: company!.id };
  }

  (hasDatabase ? it : it.skip)(
    'creates customer with party + contact, lists, updates, archives',
    async () => {
      const { agent, companyId } = await loginDemo();
      await prisma.modModuleState.upsert({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'customers' },
        },
        update: { status: 'ENABLED' },
        create: { companyId, moduleKey: 'customers', status: 'ENABLED' },
      });
      await prisma.modModuleState.upsert({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'master_data' },
        },
        update: { status: 'ENABLED' },
        create: { companyId, moduleKey: 'master_data', status: 'ENABLED' },
      });

      const code = `C-${Date.now()}`;
      const created = await agent
        .post('/api/v1/customers')
        .send({
          code,
          legalName: 'Fromagerie Atlas SARL',
          taxId: '1234567/A/M/000',
          salesRep: 'Karim',
          contacts: [{ name: 'Acheteur', phone: '+21620000000' }],
        })
        .expect(201);

      const body = created.body as CustomerBody;
      expect(body.code).toBe(code);
      expect(body.legalName).toBe('Fromagerie Atlas SARL');
      expect(body.contacts?.length).toBe(1);

      const listed = await agent
        .get(`/api/v1/customers?q=${encodeURIComponent(code)}`)
        .expect(200);
      expect(
        (listed.body as { items: CustomerBody[] }).items.some(
          (i) => i.code === code,
        ),
      ).toBe(true);

      const patched = await agent
        .patch(`/api/v1/customers/${body.id}`)
        .send({
          legalName: 'Fromagerie Atlas',
          version: body.version,
        })
        .expect(200);
      expect((patched.body as CustomerBody).legalName).toBe('Fromagerie Atlas');

      await agent.delete(`/api/v1/customers/${body.id}`).expect(204);

      await agent.get(`/api/v1/customers/${body.id}`).expect(404);

      const conflict = await agent
        .post('/api/v1/customers')
        .send({
          code: `C2-${Date.now()}`,
        })
        .expect(400);
      expect((conflict.body as { code?: string }).code).toBe(
        CUSTOMERS_ERROR_CODES.PARTY_NOT_FOUND,
      );
    },
  );
});

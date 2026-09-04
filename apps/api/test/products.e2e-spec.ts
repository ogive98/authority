import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MODULE_ERROR_CODES } from '../src/modules-registry/modules.constants';
import { TENANCY_HEADERS } from '../src/organization/organization.constants';
import { PERMISSION_ERROR_CODES } from '../src/permissions/permission.constants';
import { PRODUCTS_ERROR_CODES } from '../src/products/products.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const LIMITED_EMAIL = 'limited@authority.local';
const LIMITED_PASSWORD = 'LimitedPass123!';

type ProductBody = {
  id: string;
  sku: string;
  status: string;
  typeKey: string;
  storageClassKey: string;
};

type ListBody = { items: { sku: string }[] };
type ErrorBody = { code?: string };

describe('Products catalogue (e2e)', () => {
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

  async function login(email: string, password: string) {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email, password })
      .expect(200);
    return agent;
  }

  async function demoCompanyId(): Promise<string> {
    const company = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    if (!company) throw new Error('DEMO company missing — seed required');
    return company.id;
  }

  (hasDatabase ? it : it.skip)(
    'CRUD happy path when products enabled',
    async () => {
      const companyId = await demoCompanyId();
      await prisma.modModuleState.upsert({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'products' },
        },
        update: { status: 'ENABLED' },
        create: {
          companyId,
          moduleKey: 'products',
          status: 'ENABLED',
        },
      });
      await prisma.modModuleState.upsert({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'master_data' },
        },
        update: { status: 'ENABLED' },
        create: {
          companyId,
          moduleKey: 'master_data',
          status: 'ENABLED',
        },
      });

      const agent = await login(DEMO_EMAIL, DEMO_PASSWORD);
      const sku = `E2E-${Date.now()}`;

      const created = await agent
        .post('/api/v1/products')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          sku,
          name: 'Test fromage',
          typeKey: 'FINISHED',
          uom: 'kg',
          trackLot: true,
          perishable: true,
          storageClassKey: 'COLD',
          allergenFlags: ['milk'],
        })
        .expect(201);

      const createdBody = created.body as ProductBody;
      expect(createdBody.status).toBe('DRAFT');
      expect(createdBody.sku).toBe(sku);
      expect(createdBody.typeKey).toBe('FINISHED');

      const listed = await agent
        .get('/api/v1/products')
        .set(TENANCY_HEADERS.companyId, companyId)
        .query({ q: sku })
        .expect(200);
      const listBody = listed.body as ListBody;
      expect(listBody.items.some((p) => p.sku === sku)).toBe(true);

      const activated = await agent
        .post(`/api/v1/products/${createdBody.id}/activate`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);
      expect((activated.body as ProductBody).status).toBe('ACTIVE');

      await agent
        .post('/api/v1/products')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          sku,
          name: 'Dup',
          typeKey: 'FINISHED',
          uom: 'kg',
          storageClassKey: 'COLD',
        })
        .expect(409)
        .expect((res) => {
          expect((res.body as ErrorBody).code).toBe(
            PRODUCTS_ERROR_CODES.SKU_DUP,
          );
        });

      await agent
        .delete(`/api/v1/products/${createdBody.id}`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(204);
    },
  );

  (hasDatabase ? it : it.skip)('module DISABLED → MOD.DISABLED', async () => {
    const companyId = await demoCompanyId();
    await prisma.modModuleState.upsert({
      where: {
        companyId_moduleKey: { companyId, moduleKey: 'products' },
      },
      update: { status: 'DISABLED' },
      create: {
        companyId,
        moduleKey: 'products',
        status: 'DISABLED',
      },
    });

    const agent = await login(DEMO_EMAIL, DEMO_PASSWORD);
    await agent
      .get('/api/v1/products')
      .set(TENANCY_HEADERS.companyId, companyId)
      .expect(403)
      .expect((res) => {
        expect((res.body as ErrorBody).code).toBe(MODULE_ERROR_CODES.DISABLED);
      });

    await prisma.modModuleState.update({
      where: {
        companyId_moduleKey: { companyId, moduleKey: 'products' },
      },
      data: { status: 'ENABLED' },
    });
  });

  (hasDatabase ? it : it.skip)(
    'missing permission → IAM.FORBIDDEN',
    async () => {
      const companyId = await demoCompanyId();
      await prisma.modModuleState.upsert({
        where: {
          companyId_moduleKey: { companyId, moduleKey: 'products' },
        },
        update: { status: 'ENABLED' },
        create: {
          companyId,
          moduleKey: 'products',
          status: 'ENABLED',
        },
      });

      const agent = await login(LIMITED_EMAIL, LIMITED_PASSWORD);
      await agent
        .get('/api/v1/products')
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(403)
        .expect((res) => {
          expect((res.body as ErrorBody).code).toBe(
            PERMISSION_ERROR_CODES.FORBIDDEN,
          );
        });
    },
  );
});

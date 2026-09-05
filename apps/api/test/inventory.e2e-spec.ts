import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TENANCY_HEADERS } from '../src/organization/organization.constants';
import { INVENTORY_ERROR_CODES } from '../src/inventory/inventory.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

type BalanceBody = {
  id: string;
  onHand: string;
  reserved: string;
  available: string;
  productId: string;
  warehouseId: string;
};

describe('Inventory light (e2e)', () => {
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

  async function login() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
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
    'adjust + reserve + release happy path',
    async () => {
      const companyId = await demoCompanyId();
      for (const moduleKey of ['inventory', 'products', 'master_data'] as const) {
        await prisma.modModuleState.upsert({
          where: { companyId_moduleKey: { companyId, moduleKey } },
          update: { status: 'ENABLED' },
          create: { companyId, moduleKey, status: 'ENABLED' },
        });
      }

      const warehouse = await prisma.invWarehouse.upsert({
        where: {
          companyId_code: { companyId, code: 'MAIN' },
        },
        update: { active: true, deletedAt: null },
        create: {
          companyId,
          code: 'MAIN',
          name: 'Entrepôt principal',
        },
      });

      const sku = `INV-E2E-${Date.now()}`;
      const product = await prisma.prdProduct.create({
        data: {
          companyId,
          sku,
          name: 'Test stock',
          typeKey: 'FINISHED',
          uom: 'kg',
          storageClassKey: 'COLD',
          status: 'ACTIVE',
        },
      });

      const agent = await login();

      const adjusted = await agent
        .post('/api/v1/inventory/adjust')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          productId: product.id,
          warehouseId: warehouse.id,
          qtyDelta: 25,
          reason: 'e2e receipt',
        })
        .expect(200);

      const adjBody = adjusted.body as BalanceBody;
      expect(adjBody.onHand).toBe('25');
      expect(adjBody.available).toBe('25');

      const reserved = await agent
        .post('/api/v1/inventory/reserve')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          productId: product.id,
          warehouseId: warehouse.id,
          qty: 10,
          refType: 'sales.order',
          refId: 'e2e-so',
        })
        .expect(200);

      const resBody = reserved.body as BalanceBody;
      expect(resBody.reserved).toBe('10');
      expect(resBody.available).toBe('15');

      await agent
        .post('/api/v1/inventory/reserve')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          productId: product.id,
          warehouseId: warehouse.id,
          qty: 20,
        })
        .expect(409)
        .expect((res) => {
          expect((res.body as { code?: string }).code).toBe(
            INVENTORY_ERROR_CODES.INSUFFICIENT,
          );
        });

      const released = await agent
        .post('/api/v1/inventory/release')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          productId: product.id,
          warehouseId: warehouse.id,
          qty: 10,
        })
        .expect(200);

      expect((released.body as BalanceBody).available).toBe('25');

      const list = await agent
        .get('/api/v1/inventory/balances')
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);

      expect(
        (list.body as { items: BalanceBody[] }).items.some(
          (i) => i.productId === product.id,
        ),
      ).toBe(true);
    },
  );
});

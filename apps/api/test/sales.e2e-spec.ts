import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TENANCY_HEADERS } from '../src/organization/organization.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

type OrderBody = {
  id: string;
  number: string;
  status: string;
  amountTotal: string;
};

describe('Sales Order V0 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  jest.setTimeout(60_000);

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
    'draft → confirm reserves stock → cancel releases',
    async () => {
      const companyId = await demoCompanyId();
      for (const moduleKey of [
        'sales',
        'inventory',
        'products',
        'customers',
        'master_data',
      ] as const) {
        await prisma.modModuleState.upsert({
          where: { companyId_moduleKey: { companyId, moduleKey } },
          update: { status: 'ENABLED' },
          create: { companyId, moduleKey, status: 'ENABLED' },
        });
      }

      const warehouse = await prisma.invWarehouse.upsert({
        where: { companyId_code: { companyId, code: 'MAIN' } },
        update: { active: true, deletedAt: null },
        create: {
          companyId,
          code: 'MAIN',
          name: 'Entrepôt principal',
        },
      });

      const product = await prisma.prdProduct.create({
        data: {
          companyId,
          sku: `SO-E2E-${Date.now()}`,
          name: 'Test SO',
          typeKey: 'FINISHED',
          uom: 'kg',
          storageClassKey: 'COLD',
          status: 'ACTIVE',
        },
      });

      const party = await prisma.mdParty.create({
        data: {
          companyId,
          type: 'CUSTOMER',
          legalName: `Client SO ${Date.now()}`,
          status: 'ACTIVE',
        },
      });

      const customer = await prisma.cusCustomer.create({
        data: {
          companyId,
          partyId: party.id,
          code: `SO-C-${Date.now()}`,
          status: 'ACTIVE',
        },
      });

      await prisma.invBalance.upsert({
        where: {
          companyId_warehouseId_productId: {
            companyId,
            warehouseId: warehouse.id,
            productId: product.id,
          },
        },
        update: { onHand: 100, reserved: 0 },
        create: {
          companyId,
          warehouseId: warehouse.id,
          productId: product.id,
          onHand: 100,
          reserved: 0,
        },
      });

      const agent = await login();

      const created = await agent
        .post('/api/v1/sales/orders')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          customerId: customer.id,
          warehouseId: warehouse.id,
          notes: 'e2e',
          lines: [
            {
              productId: product.id,
              qty: 12,
              unitPrice: 8.5,
              discountPct: 0,
            },
          ],
        })
        .expect(201);

      const draft = created.body as OrderBody;
      expect(draft.status).toBe('DRAFT');
      expect(draft.amountTotal).toBe('102');

      const confirmed = await agent
        .post(`/api/v1/sales/orders/${draft.id}/confirm`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);

      expect((confirmed.body as OrderBody).status).toBe('CONFIRMED');

      const bal = await prisma.invBalance.findUnique({
        where: {
          companyId_warehouseId_productId: {
            companyId,
            warehouseId: warehouse.id,
            productId: product.id,
          },
        },
      });
      expect(bal?.reserved.toString()).toBe('12');

      await agent
        .post(`/api/v1/sales/orders/${draft.id}/cancel`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);

      const bal2 = await prisma.invBalance.findUnique({
        where: {
          companyId_warehouseId_productId: {
            companyId,
            warehouseId: warehouse.id,
            productId: product.id,
          },
        },
      });
      expect(bal2?.reserved.toString()).toBe('0');
    },
  );
});

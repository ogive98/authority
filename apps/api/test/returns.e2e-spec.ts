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

describe('Returns RMA D317 (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  jest.setTimeout(90_000);

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

  (hasDatabase ? it : it.skip)(
    'rejects RMA on non-DELIVERED shipment',
    async () => {
      const company = await prisma.orgCompany.findUnique({
        where: { code: 'DEMO' },
      });
      if (!company) throw new Error('DEMO missing');
      const companyId = company.id;

      for (const moduleKey of [
        'sales',
        'delivery',
        'inventory',
        'finance',
        'products',
        'customers',
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

      const party = await prisma.mdParty.create({
        data: {
          companyId,
          type: 'CUSTOMER',
          legalName: `Client RET ${Date.now()}`,
          status: 'ACTIVE',
        },
      });
      const customer = await prisma.cusCustomer.create({
        data: {
          companyId,
          partyId: party.id,
          code: `RET-C-${Date.now()}`,
          status: 'ACTIVE',
        },
      });

      const product = await prisma.prdProduct.create({
        data: {
          companyId,
          sku: `RET-E2E-${Date.now()}`,
          name: 'Test Return',
          typeKey: 'FINISHED',
          uom: 'kg',
          storageClassKey: 'COLD',
          status: 'ACTIVE',
        },
      });

      const order = await prisma.salOrder.create({
        data: {
          companyId,
          number: `SO-RET-${Date.now()}`,
          customerId: customer.id,
          warehouseId: warehouse.id,
          status: 'CONFIRMED',
          currency: 'TND',
          amountTotal: 50,
          confirmedAt: new Date(),
          lines: {
            create: [
              {
                companyId,
                lineNo: 1,
                productId: product.id,
                qty: 10,
                unitPrice: 5,
                discountPct: 0,
                lineTotal: 50,
                deliveredQty: 10,
              },
            ],
          },
        },
        include: { lines: true },
      });

      const shipment = await prisma.dlvShipment.create({
        data: {
          companyId,
          number: `DLV-RET-${Date.now()}`,
          orderId: order.id,
          customerId: customer.id,
          warehouseId: warehouse.id,
          status: 'OUT',
        },
      });

      const agent = await login();
      await agent
        .post('/api/v1/sales/returns/rmas')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          shipmentId: shipment.id,
          lines: [
            {
              orderLineId: order.lines[0].id,
              qty: 2,
              disposition: 'RESTOCK',
            },
          ],
        })
        .expect(409);
    },
  );
});

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

describe('Sales Quotes D316 (e2e)', () => {
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
    'create quote → send → convert → order DRAFT with discount',
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
          sku: `QT-E2E-${Date.now()}`,
          name: 'Test Quote',
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
          legalName: `Client QT ${Date.now()}`,
          status: 'ACTIVE',
        },
      });

      const customer = await prisma.cusCustomer.create({
        data: {
          companyId,
          partyId: party.id,
          code: `QT-C-${Date.now()}`,
          status: 'ACTIVE',
        },
      });
      const agent = await login();

      const created = await agent
        .post('/api/v1/sales/quotes')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          customerId: customer.id,
          warehouseId: warehouse.id,
          notes: 'e2e quote',
          lines: [
            {
              productId: product.id,
              qty: 10,
              unitPrice: 5,
              discountPct: 10,
            },
          ],
        })
        .expect(201);

      expect(created.body.status).toBe('DRAFT');
      expect(created.body.amountTotal).toBe('45');
      expect(created.body.lines[0].discountPct).toBe('10');

      const sent = await agent
        .post(`/api/v1/sales/quotes/${created.body.id}/send`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);
      expect(sent.body.status).toBe('SENT');

      const pdf = await agent
        .get(`/api/v1/sales/quotes/${created.body.id}/pdf`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .buffer(true)
        .parse((res, cb) => {
          const data: Buffer[] = [];
          res.on('data', (chunk: Buffer) => data.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(data)));
        })
        .expect(200);
      expect(pdf.headers['content-type']).toMatch(/pdf/);
      expect(Buffer.isBuffer(pdf.body) ? pdf.body.length : 0).toBeGreaterThan(
        100,
      );
      expect(pdf.headers['x-authority-document-id']).toBeTruthy();

      const converted = await agent
        .post(`/api/v1/sales/quotes/${created.body.id}/convert`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);

      expect(converted.body.quote.status).toBe('ACCEPTED');
      expect(converted.body.order.status).toBe('DRAFT');
      expect(converted.body.order.lines[0].discountPct).toBe('10');
      expect(converted.body.order.amountTotal).toBe('45');

      // Idempotent second convert
      const again = await agent
        .post(`/api/v1/sales/quotes/${created.body.id}/convert`)
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);
      expect(again.body.order.id).toBe(converted.body.order.id);
    },
  );
});

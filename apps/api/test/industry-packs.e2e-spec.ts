import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TENANCY_HEADERS } from '../src/organization/organization.constants';
import { PRODUCTS_ERROR_CODES } from '../src/products/products.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';
const SUPER_ADMIN_EMAIL = 'superadmin@authority.local';
const SUPER_ADMIN_PASSWORD = 'SuperAdminPass123!';

describe('Industry packs POLY-01 (e2e)', () => {
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

  (hasDatabase ? it : it.skip)(
    'SA lists packs; apply optic; refs change; unknown product type rejected',
    async () => {
      const company = await prisma.orgCompany.findUnique({
        where: { code: 'DEMO' },
      });
      expect(company).toBeTruthy();
      const companyId = company!.id;

      const sa = request.agent(app.getHttpServer());
      await sa
        .post('/api/super-admin/v1/auth/login')
        .send({ email: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD })
        .expect(200);

      const packs = await sa
        .get('/api/super-admin/v1/industry-packs')
        .expect(200);
      const packBody = packs.body as { packs: { key: string }[] };
      expect(packBody.packs.map((p) => p.key)).toEqual(
        expect.arrayContaining(['dairy', 'optic', 'grocery']),
      );

      await sa
        .post('/api/super-admin/v1/industry-packs/optic/apply')
        .send({ companyId })
        .expect(200)
        .expect((res) => {
          const body = res.body as { packKey: string; upserted: number };
          expect(body.packKey).toBe('optic');
          expect(body.upserted).toBeGreaterThan(0);
        });

      // restore dairy defaults for other suites (upsert keeps optic codes too)
      await sa
        .post('/api/super-admin/v1/industry-packs/dairy/apply')
        .send({ companyId })
        .expect(200);

      const demo = request.agent(app.getHttpServer());
      await demo
        .post('/api/v1/identity/auth/login')
        .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
        .expect(200);

      const refs = await demo
        .get('/api/v1/master-data/refs')
        .query({ kind: 'product_type' })
        .set(TENANCY_HEADERS.companyId, companyId)
        .expect(200);
      const items = (refs.body as { items: { code: string }[] }).items;
      expect(items.some((i) => i.code === 'FINISHED')).toBe(true);

      await demo
        .post('/api/v1/products')
        .set(TENANCY_HEADERS.companyId, companyId)
        .send({
          sku: `BAD-${Date.now()}`,
          name: 'Invalid type',
          typeKey: 'NOT_A_REAL_TYPE',
          uom: 'kg',
          storageClassKey: 'COLD',
        })
        .expect(400)
        .expect((res) => {
          expect((res.body as { code?: string }).code).toBe(
            PRODUCTS_ERROR_CODES.REF_UNKNOWN,
          );
        });
    },
  );
});

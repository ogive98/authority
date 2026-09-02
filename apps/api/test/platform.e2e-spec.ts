import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OUTBOX_EVENT_TYPES } from '../src/audit/audit.constants';
import { MinioService } from '../src/platform/minio.service';
import { PLATFORM_ERROR_CODES } from '../src/platform/platform.constants';

const DEMO_EMAIL = 'demo@authority.local';
const DEMO_PASSWORD = 'DemoPass123!';

interface AllocateResponse {
  allocatedValue: number;
  number: string;
  docType: string;
  year: number;
}

interface UploadResponse {
  id: string;
  downloadUrl: string;
  mime: string;
  size: number;
}

interface ErrorResponse {
  code: string;
}

describe('Platform numbering + files (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let minio: MinioService;
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
    minio = app.get(MinioService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function loginWithDemoContext() {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/identity/auth/login')
      .send({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const demo = await prisma.orgCompany.findUnique({
      where: { code: 'DEMO' },
    });
    const site = await prisma.orgSite.findFirst({
      where: { companyId: demo!.id, code: 'SFX' },
    });

    await agent
      .put('/api/v1/organization/me/context')
      .send({ companyId: demo!.id, siteId: site!.id })
      .expect(200);

    return { agent, companyId: demo!.id, siteId: site!.id };
  }

  it('allocates unique numbers under concurrent requests', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent, companyId, siteId } = await loginWithDemoContext();
    const year = new Date().getFullYear();

    const series = await prisma.coreNumberingSeries.findFirst({
      where: {
        companyId,
        siteId,
        docType: 'INVOICE',
        year,
      },
    });
    expect(series).not.toBeNull();

    const startValue = 1000;
    await prisma.coreNumberingSeries.update({
      where: { id: series!.id },
      data: { nextValue: startValue },
    });
    const beforeNext = startValue;

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        agent
          .post('/api/v1/platform/numbering/allocate')
          .send({ docType: 'INVOICE', year }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }

    const values = responses.map(
      (res) => (res.body as AllocateResponse).allocatedValue,
    );
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);

    const expected = Array.from(
      { length: values.length },
      (_, i) => beforeNext + i,
    );
    expect([...values].sort((a, b) => a - b)).toEqual(expected);

    const outbox = await prisma.coreOutbox.findMany({
      where: {
        eventType: OUTBOX_EVENT_TYPES.platformNumberAllocated,
        companyId,
      },
      orderBy: { createdAt: 'desc' },
      take: values.length,
    });
    expect(outbox.length).toBeGreaterThanOrEqual(values.length);
  });

  it('returns PLT.SERIES_MISSING for unknown doc type', async () => {
    if (!hasDatabase) {
      return;
    }

    const { agent } = await loginWithDemoContext();
    const res = await agent
      .post('/api/v1/platform/numbering/allocate')
      .send({ docType: 'UNKNOWN_DOC', year: 2099 })
      .expect(400);

    expect((res.body as ErrorResponse).code).toBe(
      PLATFORM_ERROR_CODES.SERIES_MISSING,
    );
  });

  it('uploads a file to MinIO and returns a signed URL', async () => {
    if (!hasDatabase || !minio.isReady()) {
      return;
    }

    const { agent } = await loginWithDemoContext();

    const upload = await agent
      .post('/api/v1/platform/files')
      .attach('file', Buffer.from('AUTHORITY SOC-09 file test'), {
        filename: 'soc09.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const body = upload.body as UploadResponse;
    expect(body.mime).toBe('text/plain');
    expect(body.size).toBeGreaterThan(0);
    expect(body.downloadUrl).toContain('http');

    const urlRes = await agent
      .get(`/api/v1/platform/files/${body.id}/url`)
      .expect(200);
    expect((urlRes.body as UploadResponse).downloadUrl).toContain('http');

    const outbox = await prisma.coreOutbox.findFirst({
      where: {
        aggregateId: body.id,
        eventType: OUTBOX_EVENT_TYPES.platformFileUploaded,
      },
    });
    expect(outbox).not.toBeNull();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

interface HealthLiveResponse {
  status: string;
  service: string;
}

interface HealthReadyResponse {
  status: string;
  checks: {
    api: string;
    postgres: string;
    redis: string;
  };
}

describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  const hasDatabase = Boolean(process.env.DATABASE_URL);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health/live (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    const body = res.body as HealthLiveResponse;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('authority-api');
  });

  it('/health/ready (GET)', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');

    if (!hasDatabase) {
      expect(res.status).toBe(503);
      return;
    }

    expect(res.status).toBe(200);
    const body = res.body as HealthReadyResponse;
    expect(body.checks.api).toBe('ok');
    expect(body.checks.postgres).toBe('ok');
    expect(['ok', 'error']).toContain(body.checks.redis);
  });
});

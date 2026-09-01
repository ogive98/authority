import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { ready: jest.Mock };

  beforeEach(async () => {
    healthService = {
      ready: jest.fn().mockResolvedValue({
        status: 'ok',
        checks: { api: 'ok', postgres: 'ok', redis: 'ok' },
        timestamp: new Date().toISOString(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('live returns ok', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('authority-api');
  });

  it('ready returns ok when checks pass', async () => {
    const result = await controller.ready();
    expect(result.status).toBe('ok');
    expect(result.checks.postgres).toBe('ok');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('live returns ok', () => {
    const result = controller.live();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('authority-api');
  });

  it('ready returns ok', () => {
    const result = controller.ready();
    expect(result.status).toBe('ok');
    expect(result.checks.api).toBe('ok');
  });
});

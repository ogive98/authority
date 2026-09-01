import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get('live')
  live() {
    return {
      status: 'ok',
      service: 'authority-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  ready() {
    // SOC-01: infrastructure checks added in SOC-02 (postgres, redis)
    return {
      status: 'ok',
      checks: {
        api: 'ok',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

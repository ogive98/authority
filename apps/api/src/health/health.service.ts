import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../infrastructure/redis.service';

export type HealthCheckStatus = 'ok' | 'error' | 'skipped';

export interface ReadyCheckResult {
  status: 'ok' | 'degraded' | 'error';
  checks: {
    api: HealthCheckStatus;
    postgres: HealthCheckStatus;
    redis: HealthCheckStatus;
  };
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async ready(): Promise<ReadyCheckResult> {
    const postgresOk = await this.prisma.ping();
    const redisOk = this.redis.isConfigured() ? await this.redis.ping() : false;

    const checks = {
      api: 'ok' as HealthCheckStatus,
      postgres: postgresOk
        ? ('ok' as HealthCheckStatus)
        : ('error' as HealthCheckStatus),
      redis: this.redis.isConfigured()
        ? redisOk
          ? ('ok' as HealthCheckStatus)
          : ('error' as HealthCheckStatus)
        : ('skipped' as HealthCheckStatus),
    };

    const criticalOk = checks.postgres === 'ok';
    const status = criticalOk
      ? checks.redis === 'error'
        ? 'degraded'
        : 'ok'
      : 'error';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

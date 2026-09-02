import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import {
  type CircuitAdmissionResult,
  type CircuitBreakerConfig,
  type CircuitBreakerSnapshot,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker.types';

function initialSnapshot(): CircuitBreakerSnapshot {
  return {
    state: 'CLOSED',
    failures: 0,
    openedAt: null,
    halfOpenProbeInFlight: false,
  };
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly memory = new Map<string, CircuitBreakerSnapshot>();
  private redis: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  async checkAdmission(dependencyKey: string): Promise<CircuitAdmissionResult> {
    const snapshot = await this.loadSnapshot(dependencyKey);
    const now = Date.now();

    if (snapshot.state === 'OPEN') {
      const openedAt = snapshot.openedAt ? Date.parse(snapshot.openedAt) : now;
      if (now - openedAt >= DEFAULT_CIRCUIT_BREAKER_CONFIG.openDurationMs) {
        snapshot.state = 'HALF_OPEN';
        snapshot.halfOpenProbeInFlight = false;
        await this.saveSnapshot(dependencyKey, snapshot);
      } else {
        return { allowed: false, state: 'OPEN', dependencyKey };
      }
    }

    if (snapshot.state === 'HALF_OPEN' && snapshot.halfOpenProbeInFlight) {
      return { allowed: false, state: 'HALF_OPEN', dependencyKey };
    }

    if (snapshot.state === 'HALF_OPEN') {
      snapshot.halfOpenProbeInFlight = true;
      await this.saveSnapshot(dependencyKey, snapshot);
    }

    return { allowed: true, state: snapshot.state, dependencyKey };
  }

  async recordSuccess(dependencyKey: string): Promise<void> {
    const snapshot = await this.loadSnapshot(dependencyKey);
    snapshot.failures = 0;
    snapshot.openedAt = null;
    snapshot.halfOpenProbeInFlight = false;
    snapshot.state = 'CLOSED';
    await this.saveSnapshot(dependencyKey, snapshot);
  }

  async recordFailure(
    dependencyKey: string,
    config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG,
  ): Promise<CircuitBreakerSnapshot> {
    const snapshot = await this.loadSnapshot(dependencyKey);
    snapshot.failures += 1;
    snapshot.halfOpenProbeInFlight = false;

    if (
      snapshot.state === 'HALF_OPEN' ||
      snapshot.failures >= config.failureThreshold
    ) {
      snapshot.state = 'OPEN';
      snapshot.openedAt = new Date().toISOString();
    }

    await this.saveSnapshot(dependencyKey, snapshot);
    return snapshot;
  }

  async forceOpen(dependencyKey: string): Promise<CircuitBreakerSnapshot> {
    const snapshot = await this.loadSnapshot(dependencyKey);
    snapshot.state = 'OPEN';
    snapshot.openedAt = new Date().toISOString();
    snapshot.halfOpenProbeInFlight = false;
    await this.saveSnapshot(dependencyKey, snapshot);
    return snapshot;
  }

  async reset(dependencyKey: string): Promise<CircuitBreakerSnapshot> {
    const snapshot = initialSnapshot();
    await this.saveSnapshot(dependencyKey, snapshot);
    return snapshot;
  }

  async getSnapshot(dependencyKey: string): Promise<CircuitBreakerSnapshot> {
    return this.loadSnapshot(dependencyKey);
  }

  private breakerKey(dependencyKey: string): string {
    const env =
      process.env.AUTHORITY_ENV ?? process.env.NODE_ENV ?? 'development';
    return `authority.${env}.thunder.breaker.${dependencyKey}`;
  }

  private getRedis(): Redis | null {
    if (!this.redisService.isConfigured()) {
      return null;
    }
    if (!this.redis) {
      this.redis = this.redisService.createBullConnection();
    }
    return this.redis;
  }

  private async loadSnapshot(
    dependencyKey: string,
  ): Promise<CircuitBreakerSnapshot> {
    const redis = this.getRedis();
    if (redis) {
      const raw = await redis.get(this.breakerKey(dependencyKey));
      if (raw) {
        return JSON.parse(raw) as CircuitBreakerSnapshot;
      }
      return initialSnapshot();
    }

    return this.memory.get(dependencyKey) ?? initialSnapshot();
  }

  private async saveSnapshot(
    dependencyKey: string,
    snapshot: CircuitBreakerSnapshot,
  ): Promise<void> {
    const redis = this.getRedis();
    if (redis) {
      await redis.set(this.breakerKey(dependencyKey), JSON.stringify(snapshot));
      return;
    }
    this.memory.set(dependencyKey, snapshot);
  }

  onModuleDestroy(): void {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {
        // ignore shutdown races
      }
      this.redis = null;
    }
  }
}

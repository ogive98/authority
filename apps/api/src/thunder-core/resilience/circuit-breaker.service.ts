import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { RedisService } from '../../infrastructure/redis.service';
import { THUNDER_DEPENDENCY_KEYS } from '../thunder.constants';
import {
  type CircuitAdmissionResult,
  type CircuitBreakerConfig,
  type CircuitBreakerListItem,
  type CircuitBreakerOutcome,
  type CircuitBreakerSnapshot,
  resolveCircuitBreakerConfig,
} from './circuit-breaker.types';

const MAX_WINDOW_ENTRIES = 500;

function initialSnapshot(): CircuitBreakerSnapshot {
  return {
    state: 'CLOSED',
    failures: 0,
    openedAt: null,
    halfOpenProbeInFlight: false,
    window: [],
    halfOpenSuccesses: 0,
  };
}

function normalizeSnapshot(
  raw: CircuitBreakerSnapshot,
): CircuitBreakerSnapshot {
  const window = Array.isArray(raw.window) ? raw.window : [];
  const failures =
    typeof raw.failures === 'number'
      ? raw.failures
      : window.filter((o) => !o.ok).length;
  return {
    state: raw.state ?? 'CLOSED',
    failures,
    openedAt: raw.openedAt ?? null,
    halfOpenProbeInFlight: Boolean(raw.halfOpenProbeInFlight),
    window,
    halfOpenSuccesses:
      typeof raw.halfOpenSuccesses === 'number' ? raw.halfOpenSuccesses : 0,
  };
}

function pruneWindow(
  window: CircuitBreakerOutcome[],
  now: number,
  slidingWindowMs: number,
): CircuitBreakerOutcome[] {
  const cutoff = now - slidingWindowMs;
  const pruned = window.filter((o) => o.at >= cutoff);
  if (pruned.length <= MAX_WINDOW_ENTRIES) {
    return pruned;
  }
  return pruned.slice(pruned.length - MAX_WINDOW_ENTRIES);
}

function recountFailures(window: CircuitBreakerOutcome[]): number {
  return window.reduce((count, o) => count + (o.ok ? 0 : 1), 0);
}

@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly memory = new Map<string, CircuitBreakerSnapshot>();
  private redis: Redis | null = null;

  constructor(private readonly redisService: RedisService) {}

  async checkAdmission(dependencyKey: string): Promise<CircuitAdmissionResult> {
    const config = resolveCircuitBreakerConfig();
    const snapshot = await this.loadSnapshot(dependencyKey);
    const now = Date.now();

    if (snapshot.state === 'OPEN') {
      const openedAt = snapshot.openedAt ? Date.parse(snapshot.openedAt) : now;
      if (now - openedAt >= config.openDurationMs) {
        snapshot.state = 'HALF_OPEN';
        snapshot.halfOpenProbeInFlight = false;
        snapshot.halfOpenSuccesses = 0;
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

  async recordSuccess(
    dependencyKey: string,
    configOverrides: Partial<CircuitBreakerConfig> = {},
  ): Promise<void> {
    const config = resolveCircuitBreakerConfig(configOverrides);
    const snapshot = await this.loadSnapshot(dependencyKey);
    const now = Date.now();

    if (snapshot.state === 'HALF_OPEN') {
      snapshot.halfOpenProbeInFlight = false;
      snapshot.halfOpenSuccesses += 1;
      snapshot.window = pruneWindow(
        [...snapshot.window, { at: now, ok: true }],
        now,
        config.slidingWindowMs,
      );
      snapshot.failures = recountFailures(snapshot.window);

      if (snapshot.halfOpenSuccesses >= config.successThreshold) {
        snapshot.state = 'CLOSED';
        snapshot.openedAt = null;
        snapshot.halfOpenSuccesses = 0;
        snapshot.window = [];
        snapshot.failures = 0;
      }

      await this.saveSnapshot(dependencyKey, snapshot);
      return;
    }

    snapshot.window = pruneWindow(
      [...snapshot.window, { at: now, ok: true }],
      now,
      config.slidingWindowMs,
    );
    snapshot.failures = recountFailures(snapshot.window);
    snapshot.halfOpenProbeInFlight = false;
    snapshot.halfOpenSuccesses = 0;
    snapshot.state = 'CLOSED';
    snapshot.openedAt = null;
    await this.saveSnapshot(dependencyKey, snapshot);
  }

  async recordFailure(
    dependencyKey: string,
    configOverrides: Partial<CircuitBreakerConfig> = {},
  ): Promise<CircuitBreakerSnapshot> {
    const config = resolveCircuitBreakerConfig(configOverrides);
    const snapshot = await this.loadSnapshot(dependencyKey);
    const now = Date.now();

    snapshot.window = pruneWindow(
      [...snapshot.window, { at: now, ok: false }],
      now,
      config.slidingWindowMs,
    );
    snapshot.failures = recountFailures(snapshot.window);
    snapshot.halfOpenProbeInFlight = false;

    if (snapshot.state === 'HALF_OPEN') {
      snapshot.state = 'OPEN';
      snapshot.openedAt = new Date().toISOString();
      snapshot.halfOpenSuccesses = 0;
      await this.saveSnapshot(dependencyKey, snapshot);
      return snapshot;
    }

    if (
      snapshot.window.length >= config.minimumThroughput &&
      snapshot.failures >= config.failureThreshold
    ) {
      snapshot.state = 'OPEN';
      snapshot.openedAt = new Date().toISOString();
      snapshot.halfOpenSuccesses = 0;
    }

    await this.saveSnapshot(dependencyKey, snapshot);
    return snapshot;
  }

  async forceOpen(dependencyKey: string): Promise<CircuitBreakerSnapshot> {
    const snapshot = await this.loadSnapshot(dependencyKey);
    snapshot.state = 'OPEN';
    snapshot.openedAt = new Date().toISOString();
    snapshot.halfOpenProbeInFlight = false;
    snapshot.halfOpenSuccesses = 0;
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

  /** Known + redis/memory breaker keys for monitor snapshot (THU-HARD-02). */
  async listBreakers(): Promise<CircuitBreakerListItem[]> {
    const keys = new Set<string>(Object.values(THUNDER_DEPENDENCY_KEYS));
    for (const key of this.memory.keys()) {
      keys.add(key);
    }

    const redis = this.getRedis();
    if (redis) {
      const pattern = this.breakerKey('*');
      const found = await redis.keys(pattern);
      const prefix = this.breakerKey('');
      for (const full of found) {
        if (full.startsWith(prefix)) {
          keys.add(full.slice(prefix.length));
        }
      }
    }

    const items: CircuitBreakerListItem[] = [];
    for (const dependencyKey of [...keys].sort()) {
      const snapshot = await this.loadSnapshot(dependencyKey);
      items.push({ dependencyKey, ...snapshot });
    }
    return items;
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
        return normalizeSnapshot(JSON.parse(raw) as CircuitBreakerSnapshot);
      }
      return initialSnapshot();
    }

    const mem = this.memory.get(dependencyKey);
    return mem ? normalizeSnapshot(mem) : initialSnapshot();
  }

  private async saveSnapshot(
    dependencyKey: string,
    snapshot: CircuitBreakerSnapshot,
  ): Promise<void> {
    const normalized = normalizeSnapshot(snapshot);
    normalized.failures = recountFailures(normalized.window);
    const redis = this.getRedis();
    if (redis) {
      await redis.set(
        this.breakerKey(dependencyKey),
        JSON.stringify(normalized),
      );
      return;
    }
    this.memory.set(dependencyKey, normalized);
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

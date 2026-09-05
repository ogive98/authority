import {
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  resolveCircuitBreakerConfig,
} from './circuit-breaker.types';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService({
      isConfigured: () => false,
      createBullConnection: () => null,
    } as never);
  });

  it('opens after failure threshold within sliding window + min throughput', async () => {
    const key = 'external_api_stub';
    const config = {
      failureThreshold: 5,
      minimumThroughput: 5,
      slidingWindowMs: 60_000,
      openDurationMs: 30_000,
      successThreshold: 2,
    };

    for (let index = 0; index < config.failureThreshold; index += 1) {
      await service.recordFailure(key, config);
    }

    const admission = await service.checkAdmission(key);
    expect(admission.allowed).toBe(false);
    expect(admission.state).toBe('OPEN');
  });

  it('does not open below minimum throughput', async () => {
    const key = 'low-traffic';
    const config = {
      failureThreshold: 5,
      minimumThroughput: 10,
      slidingWindowMs: 60_000,
      openDurationMs: 30_000,
      successThreshold: 2,
    };

    for (let index = 0; index < 5; index += 1) {
      await service.recordFailure(key, config);
    }

    const admission = await service.checkAdmission(key);
    expect(admission.allowed).toBe(true);
    expect(admission.state).toBe('CLOSED');
  });

  it('returns to closed after successThreshold half-open probes', async () => {
    const key = 'dependency-a';
    await service.forceOpen(key);

    const snapshot = await service.getSnapshot(key);
    snapshot.openedAt = new Date(Date.now() - 31_000).toISOString();
    await (
      service as unknown as {
        saveSnapshot: (k: string, s: unknown) => Promise<void>;
      }
    ).saveSnapshot(key, snapshot);

    const first = await service.checkAdmission(key);
    expect(first.allowed).toBe(true);
    expect(first.state).toBe('HALF_OPEN');

    await service.recordSuccess(key, { successThreshold: 2 });
    const mid = await service.getSnapshot(key);
    expect(mid.state).toBe('HALF_OPEN');
    expect(mid.halfOpenSuccesses).toBe(1);

    const secondProbe = await service.checkAdmission(key);
    expect(secondProbe.allowed).toBe(true);

    await service.recordSuccess(key, { successThreshold: 2 });
    const closed = await service.getSnapshot(key);
    expect(closed.state).toBe('CLOSED');
    expect(closed.failures).toBe(0);
  });

  it('lists known dependency keys', async () => {
    const listed = await service.listBreakers();
    expect(listed.some((b) => b.dependencyKey === 'external_api_stub')).toBe(
      true,
    );
  });

  it('resolveCircuitBreakerConfig applies defaults', () => {
    const cfg = resolveCircuitBreakerConfig();
    expect(cfg.failureThreshold).toBe(
      DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
    );
    expect(cfg.slidingWindowMs).toBe(
      DEFAULT_CIRCUIT_BREAKER_CONFIG.slidingWindowMs,
    );
  });
});

import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './circuit-breaker.types';
import { CircuitBreakerService } from './circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService({
      isConfigured: () => false,
      createBullConnection: () => null,
    } as never);
  });

  it('opens after the failure threshold is reached', async () => {
    const key = 'external_api_stub';

    for (
      let index = 0;
      index < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold;
      index += 1
    ) {
      await service.recordFailure(key);
    }

    const admission = await service.checkAdmission(key);
    expect(admission.allowed).toBe(false);
    expect(admission.state).toBe('OPEN');
  });

  it('returns to closed after a successful half-open probe', async () => {
    const key = 'dependency-a';
    await service.forceOpen(key);

    const snapshot = await service.getSnapshot(key);
    snapshot.openedAt = new Date(Date.now() - 31_000).toISOString();
    await (
      service as unknown as {
        saveSnapshot: (k: string, s: unknown) => Promise<void>;
      }
    ).saveSnapshot(key, snapshot);

    const admission = await service.checkAdmission(key);
    expect(admission.allowed).toBe(true);
    expect(admission.state).toBe('HALF_OPEN');

    await service.recordSuccess(key);
    const closed = await service.getSnapshot(key);
    expect(closed.state).toBe('CLOSED');
    expect(closed.failures).toBe(0);
  });
});

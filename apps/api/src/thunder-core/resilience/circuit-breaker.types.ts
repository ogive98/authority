export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export type CircuitBreakerOutcome = {
  at: number;
  ok: boolean;
};

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  /** Failures inside the current sliding window (derived). */
  failures: number;
  openedAt: string | null;
  halfOpenProbeInFlight: boolean;
  /** Rolling outcomes for sliding-window evaluation (THU-HARD-02). */
  window: CircuitBreakerOutcome[];
  /** Consecutive successes while HALF_OPEN. */
  halfOpenSuccesses: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  openDurationMs: number;
  slidingWindowMs: number;
  minimumThroughput: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  openDurationMs: 30_000,
  slidingWindowMs: 60_000,
  minimumThroughput: 10,
};

export function resolveCircuitBreakerConfig(
  overrides: Partial<CircuitBreakerConfig> = {},
): CircuitBreakerConfig {
  return {
    failureThreshold: positiveInt(
      overrides.failureThreshold ?? envInt('THUNDER_BREAKER_FAILURE_THRESHOLD'),
      DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
    ),
    successThreshold: positiveInt(
      overrides.successThreshold ?? envInt('THUNDER_BREAKER_SUCCESS_THRESHOLD'),
      DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
    ),
    openDurationMs: positiveInt(
      overrides.openDurationMs ?? envInt('THUNDER_BREAKER_OPEN_MS'),
      DEFAULT_CIRCUIT_BREAKER_CONFIG.openDurationMs,
    ),
    slidingWindowMs: positiveInt(
      overrides.slidingWindowMs ?? envInt('THUNDER_BREAKER_WINDOW_MS'),
      DEFAULT_CIRCUIT_BREAKER_CONFIG.slidingWindowMs,
    ),
    minimumThroughput: positiveInt(
      overrides.minimumThroughput ?? envInt('THUNDER_BREAKER_MIN_THROUGHPUT'),
      DEFAULT_CIRCUIT_BREAKER_CONFIG.minimumThroughput,
    ),
  };
}

function envInt(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return undefined;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function positiveInt(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.trunc(value);
}

export interface PlanCContext {
  dependencyKey: string;
  jobType?: string;
  companyId?: string;
  correlationId?: string;
}

export type PlanCHandler = (
  context: PlanCContext,
) => Promise<Record<string, unknown>>;

export interface CircuitAdmissionResult {
  allowed: boolean;
  state: CircuitBreakerState;
  dependencyKey: string;
}

export type CircuitBreakerListItem = CircuitBreakerSnapshot & {
  dependencyKey: string;
};

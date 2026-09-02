export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerSnapshot {
  state: CircuitBreakerState;
  failures: number;
  openedAt: string | null;
  halfOpenProbeInFlight: boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  openDurationMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  openDurationMs: 30_000,
};

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

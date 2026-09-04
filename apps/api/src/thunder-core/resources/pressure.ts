import type { ResourcePressureSnapshot } from './resource-manager.types';

export const PRESSURE_CPU_THRESHOLD = 0.85;
export const PRESSURE_RAM_THRESHOLD = 0.9;
export const PRESSURE_PG_THRESHOLD = 0.8;

export type PressureInput = {
  forced: boolean;
  forcedReason?: string;
  envShed: boolean;
  envCpu: number;
  envPg: number;
  liveCpu: number | null;
  liveRam: number | null;
  livePg: number | null;
};

/**
 * Load-balancing decision: shed P4 (import/analytics) under pressure.
 * Never used to pick a named worker — queues pull via BullMQ.
 */
export function evaluatePressure(
  input: PressureInput,
): ResourcePressureSnapshot {
  if (input.forced || input.envShed) {
    return {
      shedP4: true,
      reason: input.forcedReason ?? 'THUNDER_SHED_P4',
    };
  }

  if (Number.isFinite(input.envPg) && input.envPg >= PRESSURE_PG_THRESHOLD) {
    return { shedP4: true, reason: 'pg_pool_pressure' };
  }
  if (Number.isFinite(input.envCpu) && input.envCpu >= PRESSURE_CPU_THRESHOLD) {
    return { shedP4: true, reason: 'cpu_pressure' };
  }
  if (input.livePg != null && input.livePg >= PRESSURE_PG_THRESHOLD) {
    return { shedP4: true, reason: 'pg_pool_pressure' };
  }
  if (input.liveCpu != null && input.liveCpu >= PRESSURE_CPU_THRESHOLD) {
    return { shedP4: true, reason: 'cpu_pressure' };
  }
  if (input.liveRam != null && input.liveRam >= PRESSURE_RAM_THRESHOLD) {
    return { shedP4: true, reason: 'ram_pressure' };
  }

  return { shedP4: false };
}

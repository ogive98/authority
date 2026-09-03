export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Constitutional Plan A/B/C policy object (THU-06). */
export interface PlanAbcPolicy {
  jobType: string;
  timeoutMs: number;
  planA: { worker: string };
  planB: {
    maxAttempts: number;
    backoffBaseMs: number;
    backoffMaxMs: number;
    jitter: boolean;
    alternativeWorker?: string;
  };
  planC: {
    action: string;
    notify?: string;
    degrade?: string;
  };
  safeState: {
    compensate?: string;
    alertSeverity: AlertSeverity;
    audit: boolean;
  };
  idempotency: { keyTemplate: string };
  circuitBreaker?: { dependencyKey: string };
  /** Optional admission gates beyond job registry metadata. */
  moduleKey?: string;
  requiredFlag?: string;
}

export function defaultPlanAbcPolicy(jobType: string): PlanAbcPolicy {
  return {
    jobType,
    timeoutMs: 30_000,
    planA: { worker: 'default' },
    planB: {
      maxAttempts: 5,
      backoffBaseMs: 1_000,
      backoffMaxMs: 16_000,
      jitter: true,
    },
    planC: {
      action: 'fail_fast',
      degrade: 'reject_enqueue',
    },
    safeState: {
      alertSeverity: 'medium',
      audit: true,
    },
    idempotency: {
      keyTemplate: `${jobType}:{companyId}:{idempotencyKey}`,
    },
  };
}

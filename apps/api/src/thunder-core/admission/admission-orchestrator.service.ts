import { HttpStatus, Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';
import { LicenseException } from '../../license/license.exception';
import { LICENSE_STATUSES } from '../../license/license.constants';
import { LicenseService } from '../../license/license.service';
import { FeatureFlagService } from '../../modules-registry/feature-flag.service';
import { ModuleRegistryService } from '../../modules-registry/module-registry.service';
import { ResourceManagerService } from '../resources/resource-manager.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { PlanAbcPolicyService } from '../resilience/plan-abc/plan-abc-policy.service';
import type { PlanAbcPolicy } from '../resilience/plan-abc/plan-abc.types';
import {
  THUNDER_ERROR_CODES,
  type ThunderErrorCode,
  type ThunderQueueFamily,
} from '../thunder.constants';

export type AuthoritySystemMode =
  | 'NORMAL'
  | 'MAINTENANCE'
  | 'SAFE'
  | 'DEGRADED'
  | 'DEMO'
  | 'PATCH'
  | 'RECOVERY'
  | 'AUDIT'
  | 'SHADOW'
  | 'SANDBOX'
  | 'SPECTRE';

const WRITE_BLOCKING_MODES = new Set<AuthoritySystemMode>([
  'MAINTENANCE',
  'SAFE',
]);

export interface AdmissionEnqueueInput {
  jobType: string;
  companyId: string;
  queue: ThunderQueueFamily;
  idempotencyKey: string;
  correlationId?: string;
  registryModuleKey?: string;
  registryDependencyKey?: string;
}

export type AdmissionResult =
  | {
      allowed: true;
      policy: PlanAbcPolicy;
      dependencyKey?: string;
      correlationId: string;
    }
  | {
      allowed: false;
      kind: 'plan_c';
      policy: PlanAbcPolicy;
      dependencyKey: string;
      correlationId: string;
    }
  | {
      allowed: false;
      kind: 'reject';
      code: ThunderErrorCode;
      message: string;
      status: HttpStatus;
      correlationId: string;
    };

export type AdmissionRejectSnapshot = {
  total: number;
  byReason: Record<string, number>;
};

@Injectable()
export class AdmissionOrchestratorService {
  /** In-process reject counters until Prometheus (THU-HARD-04). */
  private readonly rejectTotals = new Map<string, number>();

  constructor(
    private readonly license: LicenseService,
    private readonly modules: ModuleRegistryService,
    private readonly flags: FeatureFlagService,
    private readonly resources: ResourceManagerService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly policies: PlanAbcPolicyService,
    private readonly redis: RedisService,
  ) {}

  getSystemMode(): AuthoritySystemMode {
    const raw = (process.env.AUTHORITY_SYSTEM_MODE ?? 'NORMAL').toUpperCase();
    return raw as AuthoritySystemMode;
  }

  getRejectSnapshot(): AdmissionRejectSnapshot {
    const byReason: Record<string, number> = {};
    let total = 0;
    for (const [reason, count] of this.rejectTotals.entries()) {
      byReason[reason] = count;
      total += count;
    }
    return { total, byReason };
  }

  /** Test / ops hook. */
  resetRejectSnapshot(): void {
    this.rejectTotals.clear();
  }

  /**
   * Checklist (THU-HARD-03): licence → mode → module → flag → breaker → budget.
   * Idempotency and in-flight lock stay in JobEnqueueService.
   */
  async admitEnqueue(input: AdmissionEnqueueInput): Promise<AdmissionResult> {
    const correlationId =
      input.correlationId && input.correlationId.length > 0
        ? input.correlationId
        : cryptoRandomId();

    const policy = this.policies.getOrDefault(input.jobType);

    try {
      const license = await this.license.getStatus(input.companyId);
      if (
        license.status !== LICENSE_STATUSES.active &&
        license.status !== LICENSE_STATUSES.grace
      ) {
        return this.reject(
          THUNDER_ERROR_CODES.LICENSE_INVALID,
          `License status: ${license.status}`,
          HttpStatus.FORBIDDEN,
          correlationId,
        );
      }
    } catch (error) {
      const message =
        error instanceof LicenseException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'License check failed';
      return this.reject(
        THUNDER_ERROR_CODES.LICENSE_INVALID,
        message,
        HttpStatus.FORBIDDEN,
        correlationId,
      );
    }

    const mode = this.getSystemMode();
    if (
      WRITE_BLOCKING_MODES.has(mode) &&
      process.env.THUNDER_ALLOW_ENQUEUE_IN_RESTRICTED_MODE !== 'true'
    ) {
      return this.reject(
        THUNDER_ERROR_CODES.SYSTEM_MODE_BLOCKS,
        `System mode ${mode} blocks job enqueue`,
        HttpStatus.SERVICE_UNAVAILABLE,
        correlationId,
      );
    }

    const moduleKey = policy.moduleKey ?? input.registryModuleKey;
    if (moduleKey) {
      const enabled = await this.modules.isEnabled(input.companyId, moduleKey);
      if (!enabled) {
        return this.reject(
          THUNDER_ERROR_CODES.MODULE_DISABLED,
          `Module disabled: ${moduleKey}`,
          HttpStatus.SERVICE_UNAVAILABLE,
          correlationId,
        );
      }
    }

    if (policy.requiredFlag) {
      const flagOn = await this.flags.isEnabled(
        input.companyId,
        policy.requiredFlag,
      );
      if (!flagOn) {
        return this.reject(
          THUNDER_ERROR_CODES.FLAG_DISABLED,
          `Feature flag off: ${policy.requiredFlag}`,
          HttpStatus.FORBIDDEN,
          correlationId,
        );
      }
    }

    const dependencyKey =
      policy.circuitBreaker?.dependencyKey ?? input.registryDependencyKey;
    if (dependencyKey) {
      const breaker = await this.circuitBreaker.checkAdmission(dependencyKey);
      if (!breaker.allowed) {
        this.recordReject('PLAN_C');
        return {
          allowed: false,
          kind: 'plan_c',
          policy,
          dependencyKey,
          correlationId,
        };
      }
    }

    const budget = this.resources.shouldAdmitEnqueue(
      input.queue,
      input.companyId,
    );
    if (!budget.allowed) {
      const code =
        budget.reason === 'fairness_throttle'
          ? THUNDER_ERROR_CODES.FAIRNESS_THROTTLE
          : THUNDER_ERROR_CODES.SHED_P4;
      return this.reject(
        code,
        budget.reason ?? 'Resource admission denied',
        HttpStatus.SERVICE_UNAVAILABLE,
        correlationId,
      );
    }

    return {
      allowed: true,
      policy,
      dependencyKey,
      correlationId,
    };
  }

  async tryAcquireInflightLock(
    companyId: string,
    idempotencyKey: string,
    token: string,
  ): Promise<{ acquired: boolean; key?: string }> {
    if (!this.redis.isConfigured()) {
      return { acquired: true };
    }
    const key = inflightKey(companyId, idempotencyKey);
    const acquired = await this.redis.setNx(key, token, 30);
    return { acquired, key: acquired ? key : key };
  }

  async releaseInflightLock(key: string | undefined): Promise<void> {
    if (!key) {
      return;
    }
    await this.redis.del(key);
  }

  private reject(
    code: ThunderErrorCode,
    message: string,
    status: HttpStatus,
    correlationId: string,
  ): AdmissionResult {
    this.recordReject(code);
    return {
      allowed: false,
      kind: 'reject',
      code,
      message,
      status,
      correlationId,
    };
  }

  private recordReject(reason: string): void {
    this.rejectTotals.set(reason, (this.rejectTotals.get(reason) ?? 0) + 1);
  }
}

function inflightKey(companyId: string, idempotencyKey: string): string {
  const env =
    process.env.AUTHORITY_ENV ?? process.env.NODE_ENV ?? 'development';
  return `authority.${env}.thunder.inflight.${companyId}.${idempotencyKey}`;
}

function cryptoRandomId(): string {
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

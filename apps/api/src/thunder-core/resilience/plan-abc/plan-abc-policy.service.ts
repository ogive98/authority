import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultPlanAbcPolicy, type PlanAbcPolicy } from './plan-abc.types';

@Injectable()
export class PlanAbcPolicyService implements OnModuleInit {
  private readonly logger = new Logger(PlanAbcPolicyService.name);
  private readonly policies = new Map<string, PlanAbcPolicy>();

  onModuleInit(): void {
    this.loadFromDisk();
  }

  /** Test helper — reload or inject policies without Nest lifecycle. */
  loadFromDisk(policiesDir = join(__dirname, 'policies')): void {
    this.policies.clear();
    let files: string[] = [];
    try {
      files = readdirSync(policiesDir).filter((name) => name.endsWith('.json'));
    } catch {
      this.logger.warn(`Plan A/B/C policies directory missing: ${policiesDir}`);
      return;
    }

    for (const file of files) {
      try {
        const raw = readFileSync(join(policiesDir, file), 'utf8');
        const parsed = JSON.parse(raw) as PlanAbcPolicy;
        if (!parsed.jobType) {
          continue;
        }
        this.policies.set(parsed.jobType, this.normalize(parsed));
      } catch (error) {
        this.logger.warn(
          error instanceof Error
            ? `Failed to load policy ${file}: ${error.message}`
            : `Failed to load policy ${file}`,
        );
      }
    }

    this.logger.log(`Loaded ${this.policies.size} Plan A/B/C policies`);
  }

  get(jobType: string): PlanAbcPolicy | undefined {
    return this.policies.get(jobType);
  }

  getOrDefault(jobType: string): PlanAbcPolicy {
    return this.policies.get(jobType) ?? defaultPlanAbcPolicy(jobType);
  }

  list(): PlanAbcPolicy[] {
    return [...this.policies.values()];
  }

  /** Unit-test hook */
  upsert(policy: PlanAbcPolicy): void {
    this.policies.set(policy.jobType, this.normalize(policy));
  }

  private normalize(policy: PlanAbcPolicy): PlanAbcPolicy {
    const fallback = defaultPlanAbcPolicy(policy.jobType);
    return {
      ...fallback,
      ...policy,
      planA: { ...fallback.planA, ...policy.planA },
      planB: { ...fallback.planB, ...policy.planB },
      planC: { ...fallback.planC, ...policy.planC },
      safeState: { ...fallback.safeState, ...policy.safeState },
      idempotency: { ...fallback.idempotency, ...policy.idempotency },
      circuitBreaker: policy.circuitBreaker ?? fallback.circuitBreaker,
    };
  }
}

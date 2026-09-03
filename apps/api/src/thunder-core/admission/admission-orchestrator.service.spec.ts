import { HttpStatus } from '@nestjs/common';
import { LICENSE_STATUSES } from '../../license/license.constants';
import { THUNDER_ERROR_CODES } from '../thunder.constants';
import { AdmissionOrchestratorService } from './admission-orchestrator.service';
import { defaultPlanAbcPolicy } from '../resilience/plan-abc/plan-abc.types';

describe('AdmissionOrchestratorService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  function build(overrides?: {
    licenseStatus?: string;
    moduleEnabled?: boolean;
    flagEnabled?: boolean;
    admitBudget?: { allowed: boolean; reason?: string };
    breakerAllowed?: boolean;
  }) {
    const license = {
      getStatus: jest.fn().mockResolvedValue({
        status: overrides?.licenseStatus ?? LICENSE_STATUSES.active,
      }),
    };
    const modules = {
      isEnabled: jest.fn().mockResolvedValue(overrides?.moduleEnabled ?? true),
    };
    const flags = {
      isEnabled: jest.fn().mockResolvedValue(overrides?.flagEnabled ?? true),
    };
    const resources = {
      shouldAdmitEnqueue: jest
        .fn()
        .mockReturnValue(overrides?.admitBudget ?? { allowed: true }),
    };
    const circuitBreaker = {
      checkAdmission: jest.fn().mockResolvedValue({
        allowed: overrides?.breakerAllowed ?? true,
        state: 'CLOSED',
        dependencyKey: 'external_api_stub',
      }),
    };
    const policies = {
      getOrDefault: jest.fn().mockImplementation((jobType: string) => {
        const base = defaultPlanAbcPolicy(jobType);
        if (jobType === 'thunder.module-gated.v1') {
          return { ...base, moduleKey: 'inventory' };
        }
        if (jobType === 'thunder.breaker-guarded.v1') {
          return {
            ...base,
            circuitBreaker: { dependencyKey: 'external_api_stub' },
          };
        }
        if (jobType === 'flagged.job.v1') {
          return { ...base, requiredFlag: 'platform.search' };
        }
        return base;
      }),
    };
    const redis = {
      isConfigured: jest.fn().mockReturnValue(false),
      setNx: jest.fn(),
      del: jest.fn(),
    };

    const service = new AdmissionOrchestratorService(
      license as never,
      modules as never,
      flags as never,
      resources as never,
      circuitBreaker as never,
      policies as never,
      redis as never,
    );

    return { service, license, modules, flags, resources, circuitBreaker };
  }

  afterEach(() => {
    delete process.env.AUTHORITY_SYSTEM_MODE;
    delete process.env.THUNDER_ALLOW_ENQUEUE_IN_RESTRICTED_MODE;
  });

  it('admits a normal enqueue', async () => {
    const { service } = build();
    const result = await service.admitEnqueue({
      jobType: 'thunder.hello.v1',
      companyId,
      queue: 'ops',
      idempotencyKey: 'k1',
      correlationId: 'c1',
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks enqueue in MAINTENANCE mode', async () => {
    process.env.AUTHORITY_SYSTEM_MODE = 'MAINTENANCE';
    const { service } = build();
    const result = await service.admitEnqueue({
      jobType: 'thunder.hello.v1',
      companyId,
      queue: 'ops',
      idempotencyKey: 'k1',
    });
    expect(result).toMatchObject({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.SYSTEM_MODE_BLOCKS,
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });

  it('rejects when module is disabled', async () => {
    const { service } = build({ moduleEnabled: false });
    const result = await service.admitEnqueue({
      jobType: 'thunder.module-gated.v1',
      companyId,
      queue: 'ops',
      idempotencyKey: 'k1',
    });
    expect(result).toMatchObject({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.MODULE_DISABLED,
    });
  });

  it('rejects when required flag is off', async () => {
    const { service } = build({ flagEnabled: false });
    const result = await service.admitEnqueue({
      jobType: 'flagged.job.v1',
      companyId,
      queue: 'ops',
      idempotencyKey: 'k1',
    });
    expect(result).toMatchObject({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.FLAG_DISABLED,
    });
  });

  it('returns plan_c when breaker is open', async () => {
    const { service } = build({ breakerAllowed: false });
    const result = await service.admitEnqueue({
      jobType: 'thunder.breaker-guarded.v1',
      companyId,
      queue: 'ops',
      idempotencyKey: 'k1',
    });
    expect(result).toMatchObject({
      allowed: false,
      kind: 'plan_c',
      dependencyKey: 'external_api_stub',
    });
  });

  it('rejects under shed pressure', async () => {
    const { service } = build({
      admitBudget: { allowed: false, reason: 'shed_p4' },
    });
    const result = await service.admitEnqueue({
      jobType: 'thunder.import.bulk.v1',
      companyId,
      queue: 'import',
      idempotencyKey: 'k1',
    });
    expect(result).toMatchObject({
      allowed: false,
      kind: 'reject',
      code: THUNDER_ERROR_CODES.SHED_P4,
    });
  });
});

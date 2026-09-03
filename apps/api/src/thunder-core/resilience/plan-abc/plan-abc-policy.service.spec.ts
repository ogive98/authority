import { join } from 'node:path';
import { PlanAbcPolicyService } from './plan-abc-policy.service';

describe('PlanAbcPolicyService', () => {
  it('loads JSON policies from disk', () => {
    const service = new PlanAbcPolicyService();
    service.loadFromDisk(join(__dirname, 'policies'));

    const hello = service.get('thunder.hello.v1');
    expect(hello?.planA.worker).toBe('HelloProcessor');
    expect(
      service.getOrDefault('thunder.fail.retryable.v1').planB.maxAttempts,
    ).toBe(3);
    expect(service.getOrDefault('thunder.fail.timeout.v1').timeoutMs).toBe(50);
    expect(service.getOrDefault('unknown.job.v1').jobType).toBe(
      'unknown.job.v1',
    );
  });
});

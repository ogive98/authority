import { ResourceManagerService } from './resource-manager.service';

describe('ResourceManagerService', () => {
  let service: ResourceManagerService;

  beforeEach(() => {
    delete process.env.THUNDER_SHED_P4;
    delete process.env.THUNDER_PG_POOL_USAGE;
    delete process.env.THUNDER_CPU_USAGE;
    service = new ResourceManagerService();
  });

  it('keeps critical concurrency while shedding import under pressure', () => {
    service.setShedP4(true, 'test');

    expect(service.getConcurrency('critical')).toBeGreaterThan(0);
    expect(service.getConcurrency('import')).toBe(0);
    expect(service.shouldAdmitEnqueue('import', 'company-1').allowed).toBe(
      false,
    );
    expect(service.shouldAdmitEnqueue('critical', 'company-1').allowed).toBe(
      true,
    );
  });

  it('throttles fairness burst on import queue', () => {
    process.env.THUNDER_FAIRNESS_BURST = '2';
    process.env.THUNDER_FAIRNESS_REFILL_PER_SEC = '1';
    service = new ResourceManagerService();

    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(true);
    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(true);
    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(false);
  });
});

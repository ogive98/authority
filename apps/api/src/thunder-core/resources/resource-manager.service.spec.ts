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

  it('sheds import from live RAM sample, never critical', () => {
    service.observeLive({
      cpuUsageRatio: 0.1,
      ramUsageRatio: 0.96,
      pgPoolUsage: null,
      sampledAt: Date.now(),
    });

    expect(service.getPressure().reason).toBe('ram_pressure');
    expect(service.getConcurrency('import')).toBe(0);
    expect(service.getConcurrency('critical')).toBeGreaterThan(0);
    expect(service.shouldAdmitEnqueue('critical', 'c1').allowed).toBe(true);
  });

  it('throttles fairness burst on import queue', () => {
    process.env.THUNDER_FAIRNESS_BURST = '2';
    process.env.THUNDER_FAIRNESS_REFILL_PER_SEC = '1';
    service = new ResourceManagerService();

    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(true);
    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(true);
    expect(service.shouldAdmitEnqueue('import', 'c1').allowed).toBe(false);
  });

  it('exposes live sample for the monitor snapshot', () => {
    expect(service.getLiveSample()).toBeNull();
    service.observeLive({
      cpuUsageRatio: 0.2,
      ramUsageRatio: 0.3,
      pgPoolUsage: null,
      sampledAt: 1,
    });
    expect(service.getLiveSample()?.cpuUsageRatio).toBe(0.2);
  });
});

import { MonitorSnapshotService } from './monitor-snapshot.service';

describe('MonitorSnapshotService', () => {
  function mockPrisma(
    lag = {
      unpublished: 4,
      oldest: 12.5,
      p50: 5,
      p95: 10,
      p99: 11,
    },
  ) {
    return {
      thunderJob: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', queue: 'ops', _count: { _all: 2 } },
          { status: 'RUNNING', queue: 'critical', _count: { _all: 1 } },
        ]),
      },
      thunderDlqEntry: { count: jest.fn().mockResolvedValue(3) },
      coreOutbox: {
        count: jest.fn().mockResolvedValue(120),
      },
      $queryRaw: jest
        .fn()
        .mockImplementation((strings: TemplateStringsArray) => {
          const sql = strings.join(' ');
          if (sql.includes('core_outbox') || sql.includes('percentile_cont')) {
            return Promise.resolve([lag]);
          }
          return Promise.resolve([{ '?column?': 1 }]);
        }),
    };
  }

  const circuitBreaker = {
    listBreakers: jest.fn().mockResolvedValue([
      {
        dependencyKey: 'external_api_stub',
        state: 'CLOSED',
        failures: 0,
        openedAt: null,
        halfOpenProbeInFlight: false,
        window: [],
        halfOpenSuccesses: 0,
      },
    ]),
  };

  const admission = {
    getRejectSnapshot: jest.fn().mockReturnValue({
      total: 2,
      byReason: { 'THUNDER.SHED_P4': 2 },
    }),
  };

  const metrics = {
    contentType: 'text/plain; version=0.0.4; charset=utf-8',
    syncGauges: jest.fn(),
    summaryCounters: jest.fn().mockResolvedValue({
      jobSuccessTotal: 5,
      jobFailTotal: 1,
      jobRetryTotal: 2,
      admissionRejectTotal: 2,
    }),
  };

  it('builds a schemaVersion 1 snapshot with outbox lag seconds and breakers', async () => {
    const prisma = mockPrisma();
    const redis = {
      ping: jest.fn().mockResolvedValue(true),
      getUsedMemoryBytes: jest.fn().mockResolvedValue(1024),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    const resources = {
      getPressure: jest.fn().mockReturnValue({ shedP4: false }),
      getConcurrency: jest.fn().mockReturnValue(2),
      getLiveSample: jest.fn().mockReturnValue(null),
    };

    const service = new MonitorSnapshotService(
      prisma as never,
      redis as never,
      resources as never,
      circuitBreaker as never,
      admission as never,
      metrics as never,
    );

    const snap = await service.snapshot();
    expect(snap.schemaVersion).toBe(1);
    expect(snap.asOf).toBeTruthy();
    expect(snap.jobs.pending).toBe(2);
    expect(snap.jobs.running).toBe(1);
    expect(snap.jobs.dlq).toBe(3);
    expect(snap.events.outboxLag).toBe(4);
    expect(snap.events.outboxLagSeconds).toEqual({
      oldest: 12.5,
      p50: 5,
      p95: 10,
      p99: 11,
    });
    expect(snap.breakers).toEqual([
      {
        dependencyKey: 'external_api_stub',
        state: 'CLOSED',
        stateGauge: 0,
        failures: 0,
        openedAt: null,
      },
    ]);
    expect(snap.admission).toEqual({
      rejectTotal: 2,
      rejectByReason: { 'THUNDER.SHED_P4': 2 },
    });
    expect(snap.metrics.scrapePath).toBe('/api/v1/thunder/metrics');
    expect(snap.metrics.jobSuccessTotal).toBe(5);
    expect(metrics.syncGauges).toHaveBeenCalled();
    expect(snap.events.eventsPerSecondEstimate).toBe(2);
    expect(snap.redis.ok).toBe(true);
    expect(snap.db.ok).toBe(true);
    expect(snap.ram.totalBytes).toBeGreaterThan(0);
    expect(Array.isArray(snap.queues)).toBe(true);
    expect(snap.workers.queues.length).toBeGreaterThan(0);
  });

  it('prefers live process CPU over loadavg', async () => {
    const prisma = {
      thunderJob: { groupBy: jest.fn().mockResolvedValue([]) },
      thunderDlqEntry: { count: jest.fn().mockResolvedValue(0) },
      coreOutbox: {
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest
        .fn()
        .mockImplementation((strings: TemplateStringsArray) => {
          const sql = strings.join(' ');
          if (sql.includes('core_outbox')) {
            return Promise.resolve([
              {
                unpublished: 0,
                oldest: null,
                p50: null,
                p95: null,
                p99: null,
              },
            ]);
          }
          return Promise.resolve([{ '?column?': 1 }]);
        }),
    };
    const redis = {
      ping: jest.fn().mockResolvedValue(true),
      getUsedMemoryBytes: jest.fn().mockResolvedValue(0),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    const resources = {
      getPressure: jest
        .fn()
        .mockReturnValue({ shedP4: true, reason: 'ram_pressure' }),
      getConcurrency: jest.fn().mockReturnValue(0),
      getLiveSample: jest.fn().mockReturnValue({
        cpuUsageRatio: 0.42,
        ramUsageRatio: 0.5,
        pgPoolUsage: null,
        sampledAt: Date.now(),
      }),
    };

    const service = new MonitorSnapshotService(
      prisma as never,
      redis as never,
      resources as never,
      circuitBreaker as never,
      admission as never,
      metrics as never,
    );
    const snap = await service.snapshot();
    expect(snap.cpu.usageRatio).toBe(0.42);
    expect(snap.pressure.shedP4).toBe(true);
    expect(snap.events.outboxLagSeconds.oldest).toBeNull();
  });
});

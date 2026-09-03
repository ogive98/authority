import { MonitorSnapshotService } from './monitor-snapshot.service';

describe('MonitorSnapshotService', () => {
  it('builds a schemaVersion 1 snapshot with required gauges', async () => {
    const prisma = {
      thunderJob: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', queue: 'ops', _count: { _all: 2 } },
          { status: 'RUNNING', queue: 'critical', _count: { _all: 1 } },
        ]),
      },
      thunderDlqEntry: { count: jest.fn().mockResolvedValue(3) },
      coreOutbox: {
        count: jest.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(120),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const redis = {
      ping: jest.fn().mockResolvedValue(true),
      getUsedMemoryBytes: jest.fn().mockResolvedValue(1024),
      isConfigured: jest.fn().mockReturnValue(true),
    };
    const resources = {
      getPressure: jest.fn().mockReturnValue({ shedP4: false }),
      getConcurrency: jest.fn().mockReturnValue(2),
    };

    const service = new MonitorSnapshotService(
      prisma as never,
      redis as never,
      resources as never,
    );

    const snap = await service.snapshot();
    expect(snap.schemaVersion).toBe(1);
    expect(snap.asOf).toBeTruthy();
    expect(snap.jobs.pending).toBe(2);
    expect(snap.jobs.running).toBe(1);
    expect(snap.jobs.dlq).toBe(3);
    expect(snap.events.outboxLag).toBe(4);
    expect(snap.events.eventsPerSecondEstimate).toBe(2);
    expect(snap.redis.ok).toBe(true);
    expect(snap.db.ok).toBe(true);
    expect(snap.ram.totalBytes).toBeGreaterThan(0);
    expect(Array.isArray(snap.queues)).toBe(true);
    expect(snap.workers.queues.length).toBeGreaterThan(0);
  });
});

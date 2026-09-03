import { WatchdogService } from './watchdog.service';

describe('WatchdogService', () => {
  it('requeues stalled idempotent jobs', async () => {
    const update = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'job-1',
        companyId: 'c1',
        jobType: 'thunder.hello.v1',
        queue: 'ops',
        priority: 2,
        idempotencyKey: 'k1',
        payloadJson: {},
        attempts: 1,
      },
    ]);
    const requeueExisting = jest.fn().mockResolvedValue(undefined);
    const dlqRecord = jest.fn();

    const service = new WatchdogService(
      {
        thunderJob: { findMany, update },
      } as never,
      {
        getStallThresholdMs: () => 1_000,
      } as never,
      { requeueExisting } as never,
      { record: dlqRecord } as never,
    );

    const handled = await service.scanOnce();
    expect(handled).toBe(1);
    expect(requeueExisting).toHaveBeenCalledWith({
      jobId: 'job-1',
      jobType: 'thunder.hello.v1',
      queue: 'ops',
      priority: 2,
    });
    expect(dlqRecord).not.toHaveBeenCalled();
  });

  it('sends non-idempotent stalled jobs to DLQ', async () => {
    const update = jest.fn().mockResolvedValue({});
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'job-2',
        companyId: 'c1',
        jobType: 'thunder.hello.v1',
        queue: 'ops',
        priority: 2,
        idempotencyKey: null,
        payloadJson: {},
        attempts: 2,
      },
    ]);
    const requeueExisting = jest.fn();
    const dlqRecord = jest.fn().mockResolvedValue({});

    const service = new WatchdogService(
      {
        thunderJob: { findMany, update },
      } as never,
      {
        getStallThresholdMs: () => 1_000,
      } as never,
      { requeueExisting } as never,
      { record: dlqRecord } as never,
    );

    await service.scanOnce();
    expect(dlqRecord).toHaveBeenCalled();
    expect(requeueExisting).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
  });
});

import { REPAIR_SCENARIOS } from './catalogs/scenarios.catalog';
import { RepairExecutorsService } from './executors/repair-executors.service';
import { SnapshotEngine } from './engines/snapshot.engine';

describe('Repair D086 SAFE/LOW executor coverage', () => {
  it('wires every SAFE and LOW scenario to an allowlisted executor', () => {
    const executors = new RepairExecutorsService(
      {} as never,
      { isConfigured: () => false } as never,
      { scanOnce: async () => 0 } as never,
      new SnapshotEngine(),
    );
    const missing = REPAIR_SCENARIOS.filter(
      (s) =>
        (s.risk === 'SAFE' || s.risk === 'LOW') &&
        !executors.hasExecutor(s.id),
    ).map((s) => s.id);
    expect(missing).toEqual([]);
    expect(executors.listExecutableScenarioIds().length).toBeGreaterThanOrEqual(
      REPAIR_SCENARIOS.filter((s) => s.risk === 'SAFE' || s.risk === 'LOW')
        .length,
    );
  });
});

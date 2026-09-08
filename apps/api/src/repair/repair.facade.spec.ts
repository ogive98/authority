import { HttpStatus } from '@nestjs/common';
import { RepExecutionStatus, RepRiskLevel, RepScanStatus } from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { HealthCheckersService } from './checkers/health-checkers.service';
import { RepairEngine } from './engines/repair.engine';
import { RepairRegistryService } from './engines/registry.service';
import { ScanEngine } from './engines/scan.engine';
import { SnapshotEngine } from './engines/snapshot.engine';
import { VerificationEngine } from './engines/verification.engine';
import { RepairException } from './repair.exception';
import { REPAIR_ERROR_CODES } from './repair.constants';
import { SCAN_LEVELS_BY_ID } from './catalogs/scan-levels.catalog';

function mockPrisma() {
  const scanRow = {
    id: '11111111-1111-4111-8111-111111111111',
    companyId: null,
    depth: 'L1',
    domainsJson: [],
    status: RepScanStatus.RUNNING,
    findingCount: 0,
    errorCount: 0,
  };

  const findingRow = {
    id: '22222222-2222-4222-8222-222222222222',
    scanId: scanRow.id,
    component: 'redis',
    category: 'redis',
    severity: 'WARN',
    evidenceFingerprint: 'fp-redis',
  };

  const prisma: Record<string, unknown> = {
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(prisma),
    ),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $connect: jest.fn().mockResolvedValue(undefined),
    repScanExecution: {
      create: jest.fn().mockResolvedValue(scanRow),
      update: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({
          ...scanRow,
          ...data,
          status: RepScanStatus.COMPLETED,
          findings: [findingRow],
        }),
      ),
    },
    repDiagnosticFinding: {
      create: jest.fn().mockResolvedValue(findingRow),
      findUnique: jest.fn(),
    },
    repDiagnosticIncident: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'inc-1' }),
      update: jest.fn(),
    },
    coreOutbox: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    },
    repRepairExecution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return prisma;
}

describe('RepairFacade / engines', () => {
  const registry = new RepairRegistryService();
  const snapshots = new SnapshotEngine();

  it('scan creates findings from health checkers via runForDepth', async () => {
    const prisma = mockPrisma();
    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    } as unknown as OutboxService;
    const checkers = {
      runForDepth: jest.fn().mockResolvedValue([
        {
          component: 'redis',
          category: 'redis',
          severity: 'WARN',
          confidence: 'PROBABLE',
          evidenceSummary: 'REDIS_URL not set',
          evidenceFingerprint: 'fp-redis',
          signatureCandidate: 'REDIS_UNAVAILABLE_V1',
        },
      ]),
      runL0L1: jest.fn(),
    } as unknown as HealthCheckersService;

    const engine = new ScanEngine(
      prisma as never,
      outbox,
      checkers,
      registry,
    );

    const result = await engine.run({ depth: 'L1', domains: [] });

    expect(checkers.runForDepth).toHaveBeenCalledWith(
      'L1',
      expect.objectContaining({
        checkers: expect.arrayContaining(['postgres', 'redis']),
      }),
    );
    expect((prisma.repScanExecution as { create: jest.Mock }).create).toHaveBeenCalled();
    expect(
      (prisma.repDiagnosticFinding as { create: jest.Mock }).create,
    ).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'repair.scan.completed.v1' }),
    );
    expect(result.status).toBe(RepScanStatus.COMPLETED);
    expect(result.findings?.length).toBeGreaterThanOrEqual(1);
  });

  it('L2 scan level includes structural checkers', () => {
    const l2 = SCAN_LEVELS_BY_ID.get('L2');
    expect(l2?.includesCheckers).toEqual(
      expect.arrayContaining([
        'prisma-migrations',
        'manifest-structure',
        'thunder-job-queues',
        'env-presence',
      ]),
    );
  });

  it('L3/L4 include integrity / audit slice checkers', () => {
    const l3 = SCAN_LEVELS_BY_ID.get('L3');
    const l4 = SCAN_LEVELS_BY_ID.get('L4');
    expect(l3?.includesCheckers).toEqual(
      expect.arrayContaining([
        'capability-permission',
        'stuck-repair-executions',
        'dlq-pressure',
      ]),
    );
    expect(l4?.includesCheckers).toEqual(
      expect.arrayContaining([
        'permission-catalog',
        'license-cache-readonly',
      ]),
    );
  });

  it('blocked scenario cannot execute', async () => {
    const prisma = mockPrisma();
    const executionId = '33333333-3333-4333-8333-333333333333';
    (prisma.repRepairExecution as { findUnique: jest.Mock }).findUnique =
      jest.fn().mockResolvedValue({
        id: executionId,
        scenarioId: 'REP-REDIS-FLUSHALL-BLOCKED',
        risk: RepRiskLevel.BLOCKED,
        dryRun: true,
        companyId: null,
        snapshotRef: null,
        status: RepExecutionStatus.PLANNED,
      });

    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    } as unknown as OutboxService;
    const executors = {
      hasExecutor: jest.fn().mockReturnValue(false),
      require: jest.fn(),
    };
    const verification = new VerificationEngine(
      prisma as never,
      registry,
      executors as never,
    );
    const engine = new RepairEngine(
      prisma as never,
      outbox,
      registry,
      snapshots,
      verification,
      executors as never,
    );

    await expect(
      engine.execute({ executionId, confirm: true, dryRun: false }),
    ).rejects.toMatchObject({
      code: REPAIR_ERROR_CODES.RISK_BLOCKED,
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('SAFE dry-run works with executor plan', async () => {
    const prisma = mockPrisma();
    const executionId = '44444444-4444-4444-8444-444444444444';
    const planned = {
      id: executionId,
      scenarioId: 'REP-REDIS-001',
      risk: RepRiskLevel.SAFE,
      dryRun: true,
      companyId: null,
      snapshotRef: null,
      status: RepExecutionStatus.PLANNED,
      planJson: {},
    };

    (prisma.repRepairExecution as { create: jest.Mock }).create = jest
      .fn()
      .mockResolvedValue(planned);
    (prisma.repRepairExecution as { findUnique: jest.Mock }).findUnique =
      jest.fn().mockResolvedValue(planned);
    (prisma.repRepairExecution as { update: jest.Mock }).update = jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...planned, ...data }),
      );

    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    } as unknown as OutboxService;
    const executors = {
      hasExecutor: jest.fn().mockReturnValue(true),
      require: jest.fn().mockReturnValue({
        dryRun: jest.fn().mockResolvedValue({
          mode: 'dry-run',
          scenarioId: 'REP-REDIS-001',
          wouldApply: true,
          plannedActions: ['DEL exact keys'],
          note: 'ok',
        }),
        apply: jest.fn(),
        verify: jest.fn(),
      }),
    };
    const verification = new VerificationEngine(
      prisma as never,
      registry,
      executors as never,
    );
    const engine = new RepairEngine(
      prisma as never,
      outbox,
      registry,
      snapshots,
      verification,
      executors as never,
    );

    const plannedRow = await engine.plan({ scenarioId: 'REP-REDIS-001' });
    expect(plannedRow.scenarioId).toBe('REP-REDIS-001');
    expect(plannedRow.risk).toBe(RepRiskLevel.SAFE);

    const dry = await engine.dryRun({ executionId });
    expect(dry.status).toBe(RepExecutionStatus.DRY_RUN);
    expect(dry.dryRun).toBe(true);
    expect((dry.resultJson as { mode: string }).mode).toBe('dry-run');
    expect((dry.resultJson as { wouldExecute: boolean }).wouldExecute).toBe(
      true,
    );
  });

  it('SAFE execute calls allowlisted executor apply+verify', async () => {
    const prisma = mockPrisma();
    const executionId = '55555555-5555-4555-8555-555555555555';
    const planned = {
      id: executionId,
      scenarioId: 'REP-REDIS-001',
      risk: RepRiskLevel.SAFE,
      dryRun: true,
      companyId: null,
      snapshotRef: null,
      status: RepExecutionStatus.PLANNED,
      planJson: {},
    };
    (prisma.repRepairExecution as { findUnique: jest.Mock }).findUnique =
      jest.fn().mockResolvedValue(planned);
    (prisma.repRepairExecution as { update: jest.Mock }).update = jest
      .fn()
      .mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...planned, ...data }),
      );

    const apply = jest.fn().mockResolvedValue({
      applied: true,
      scenarioId: 'REP-REDIS-001',
      actions: ['del-exact:1'],
      sideEffects: 'technical-cache-only',
      details: { exactDeleted: 1 },
    });
    const verify = jest.fn().mockResolvedValue({
      ok: true,
      expected: 'cache-namespace-empty-and-rebuildable',
      checkedAt: new Date().toISOString(),
      mode: 'live',
    });
    const executors = {
      hasExecutor: jest.fn().mockReturnValue(true),
      require: jest.fn().mockReturnValue({
        dryRun: jest.fn(),
        apply,
        verify,
      }),
    };
    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    } as unknown as OutboxService;
    const verification = new VerificationEngine(
      prisma as never,
      registry,
      executors as never,
    );
    const engine = new RepairEngine(
      prisma as never,
      outbox,
      registry,
      snapshots,
      verification,
      executors as never,
    );

    const result = await engine.execute({
      executionId,
      confirm: true,
      dryRun: false,
    });
    expect(apply).toHaveBeenCalled();
    expect(verify).toHaveBeenCalled();
    expect(result.status).toBe(RepExecutionStatus.SUCCEEDED);
  });

  it('RepairException carries code', () => {
    const err = new RepairException(
      REPAIR_ERROR_CODES.NOT_FOUND,
      'missing',
      HttpStatus.NOT_FOUND,
    );
    expect(err.code).toBe(REPAIR_ERROR_CODES.NOT_FOUND);
    expect(err.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });
});

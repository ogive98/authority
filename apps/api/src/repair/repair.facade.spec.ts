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

  it('scan creates findings from health checkers', async () => {
    const prisma = mockPrisma();
    const outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
    } as unknown as OutboxService;
    const checkers = {
      runL0L1: jest.fn().mockResolvedValue([
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
    } as unknown as HealthCheckersService;

    const engine = new ScanEngine(
      prisma as never,
      outbox,
      checkers,
      registry,
    );

    const result = await engine.run({ depth: 'L1', domains: [] });

    expect(prisma.repScanExecution.create).toHaveBeenCalled();
    expect(prisma.repDiagnosticFinding.create).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'repair.scan.completed.v1' }),
    );
    expect(result.status).toBe(RepScanStatus.COMPLETED);
    expect(result.findings?.length).toBeGreaterThanOrEqual(1);
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
    const verification = new VerificationEngine(prisma as never);
    const engine = new RepairEngine(
      prisma as never,
      outbox,
      registry,
      snapshots,
      verification,
    );

    await expect(
      engine.execute({ executionId, confirm: true, dryRun: false }),
    ).rejects.toMatchObject({
      code: REPAIR_ERROR_CODES.RISK_BLOCKED,
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('SAFE dry-run works', async () => {
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
    const verification = new VerificationEngine(prisma as never);
    const engine = new RepairEngine(
      prisma as never,
      outbox,
      registry,
      snapshots,
      verification,
    );

    const plannedRow = await engine.plan({ scenarioId: 'REP-REDIS-001' });
    expect(plannedRow.scenarioId).toBe('REP-REDIS-001');
    expect(plannedRow.risk).toBe(RepRiskLevel.SAFE);

    const dry = await engine.dryRun({ executionId });
    expect(dry.status).toBe(RepExecutionStatus.DRY_RUN);
    expect(dry.dryRun).toBe(true);
    expect((dry.resultJson as { mode: string }).mode).toBe('dry-run');
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

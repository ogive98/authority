import { HttpStatus } from '@nestjs/common';
import { RepRiskLevel } from '@prisma/client';
import { RepairEngine } from './engines/repair.engine';
import { RepairRegistryService } from './engines/registry.service';
import { REPAIR_ERROR_CODES } from './repair.constants';
import { RepairException } from './repair.exception';

describe('RepairEngine risk gates', () => {
  const registry = new RepairRegistryService();

  const executors = {
    hasExecutor: jest.fn().mockReturnValue(true),
    require: jest.fn(),
    listExecutableScenarioIds: jest.fn().mockReturnValue(['REP-REDIS-001']),
  };

  it('lists pack scenarios including BLOCKED markers', () => {
    const all = registry.listScenarios();
    expect(all.length).toBeGreaterThan(20);
    expect(all.some((s) => s.risk === 'BLOCKED')).toBe(true);
    expect(all.some((s) => s.id === 'REP-REDIS-001')).toBe(true);
  });

  it('requires confirm for execute', async () => {
    const prisma = {
      repRepairExecution: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ex-1',
          scenarioId: 'REP-REDIS-001',
          risk: RepRiskLevel.SAFE,
          status: 'PLANNED',
        }),
      },
    };
    const engine = new RepairEngine(
      prisma as never,
      { enqueue: jest.fn() } as never,
      registry,
      { create: jest.fn() } as never,
      { verify: jest.fn(), recordLive: jest.fn() } as never,
      executors as never,
    );

    await expect(
      engine.execute({ executionId: 'ex-1', confirm: false }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: REPAIR_ERROR_CODES.CONFIRM_REQUIRED,
      }),
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('blocks BLOCKED scenario execute', async () => {
    const blocked = registry
      .listScenarios()
      .find((s) => s.risk === 'BLOCKED');
    expect(blocked).toBeDefined();

    const prisma = {
      repRepairExecution: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ex-b',
          scenarioId: blocked!.id,
          risk: RepRiskLevel.BLOCKED,
          status: 'PLANNED',
        }),
        update: jest.fn(),
      },
    };
    const engine = new RepairEngine(
      prisma as never,
      { enqueue: jest.fn() } as never,
      registry,
      { create: jest.fn() } as never,
      { verify: jest.fn(), recordLive: jest.fn() } as never,
      executors as never,
    );

    await expect(
      engine.execute({ executionId: 'ex-b', confirm: true }),
    ).rejects.toBeInstanceOf(RepairException);
  });

  it('refuses SAFE scenario without allowlisted executor', async () => {
    const prisma = {
      repRepairExecution: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ex-no',
          scenarioId: 'REP-FS-001',
          risk: RepRiskLevel.SAFE,
          status: 'PLANNED',
          companyId: null,
        }),
        update: jest.fn(),
      },
    };
    const noExec = {
      hasExecutor: jest.fn().mockReturnValue(false),
      require: jest.fn().mockImplementation(() => {
        throw new RepairException(
          REPAIR_ERROR_CODES.NO_EXECUTOR,
          'no executor',
          HttpStatus.BAD_REQUEST,
        );
      }),
    };
    const engine = new RepairEngine(
      prisma as never,
      { enqueue: jest.fn() } as never,
      registry,
      { create: jest.fn() } as never,
      { verify: jest.fn(), recordLive: jest.fn() } as never,
      noExec as never,
    );

    await expect(
      engine.execute({ executionId: 'ex-no', confirm: true }),
    ).rejects.toMatchObject({
      code: REPAIR_ERROR_CODES.NO_EXECUTOR,
    });
  });
});

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ExecutorVerifyResult } from '../executors/executor.types';
import { RepairExecutorsService } from '../executors/repair-executors.service';
import { REPAIR_ERROR_CODES } from '../repair.constants';
import { RepairException } from '../repair.exception';
import { RepairRegistryService } from './registry.service';

@Injectable()
export class VerificationEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RepairRegistryService,
    private readonly executors: RepairExecutorsService,
  ) {}

  async verify(executionId: string) {
    const row = await this.prisma.repRepairExecution.findUnique({
      where: { id: executionId },
    });
    if (!row) {
      throw new RepairException(
        REPAIR_ERROR_CODES.NOT_FOUND,
        `Repair execution not found: ${executionId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = row.verificationJson as Record<string, unknown> | null;
    if (existing && typeof existing === 'object' && existing.mode === 'live') {
      return { executionId, ...existing, source: 'stored' as const };
    }

    const scenario = this.registry.getScenario(row.scenarioId);
    if (scenario && this.executors.hasExecutor(scenario.id)) {
      const live = await this.executors.require(scenario.id).verify({
        scenarioId: scenario.id,
        expected: scenario.verification,
        applyResult: row.resultJson as Record<string, unknown> | null,
      });
      await this.recordLive(executionId, live);
      return { executionId, ...live, source: 'live' as const };
    }

    const result = {
      executionId,
      ok: row.status === 'SUCCEEDED',
      expected: scenario?.verification ?? 'stored-or-stub',
      checkedAt: new Date().toISOString(),
      mode: 'stub' as const,
      note: 'No live executor — status-based verification',
    };

    await this.prisma.repRepairExecution.update({
      where: { id: executionId },
      data: { verificationJson: result },
    });

    return result;
  }

  async recordLive(executionId: string, result: ExecutorVerifyResult) {
    const payload = {
      executionId,
      ...result,
    };
    await this.prisma.repRepairExecution.update({
      where: { id: executionId },
      data: { verificationJson: payload as Prisma.InputJsonValue },
    });
    return payload;
  }

  /** @deprecated Use executor.verify + recordLive */
  async verifyExecution(
    executionId: string,
    opts: { stubOk: boolean; expected: string },
  ) {
    return {
      executionId,
      ok: opts.stubOk,
      expected: opts.expected,
      checkedAt: new Date().toISOString(),
      mode: 'stub' as const,
      note: 'Verification stub — prefer live executor verify',
    };
  }
}

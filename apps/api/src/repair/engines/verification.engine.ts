import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { REPAIR_ERROR_CODES } from '../repair.constants';
import { RepairException } from '../repair.exception';

@Injectable()
export class VerificationEngine {
  constructor(private readonly prisma: PrismaService) {}

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
    if (existing && typeof existing === 'object') {
      return { executionId, ...existing, source: 'stored' as const };
    }

    const result = await this.verifyExecution(executionId, {
      stubOk: row.status === 'SUCCEEDED',
      expected: 'stored-or-stub',
    });

    await this.prisma.repRepairExecution.update({
      where: { id: executionId },
      data: { verificationJson: result },
    });

    return result;
  }

  async verifyExecution(
    executionId: string,
    opts: { stubOk: boolean; expected: string },
  ) {
    return {
      executionId,
      ok: opts.stubOk,
      expected: opts.expected,
      checkedAt: new Date().toISOString(),
      mode: 'stub',
      note: 'Verification stub — no live probe beyond execution status',
    };
  }
}

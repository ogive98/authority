import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  RepExecutionStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RepairExecutorsService } from '../executors/repair-executors.service';
import { REPAIR_ERROR_CODES } from '../repair.constants';
import { RepairException } from '../repair.exception';

export interface ResetScope {
  id: string;
  label: string;
  risk: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  destructive: boolean;
  description: string;
}

const RESET_SCOPES: readonly ResetScope[] = [
  {
    id: 'cache',
    label: 'Cache',
    risk: 'SAFE',
    destructive: false,
    description: 'Targeted technical cache clear — no business data',
  },
  {
    id: 'technical-temp',
    label: 'Technical temp',
    risk: 'LOW',
    destructive: false,
    description: 'Expired temporary technical files',
  },
  {
    id: 'configuration',
    label: 'Configuration',
    risk: 'MEDIUM',
    destructive: false,
    description: 'Configuration reload / reconcile (preview only here)',
  },
  {
    id: 'module',
    label: 'Module',
    risk: 'HIGH',
    destructive: false,
    description: 'Module state/config reset — requires approval',
  },
  {
    id: 'application',
    label: 'Application',
    risk: 'HIGH',
    destructive: true,
    description: 'Broad technical application reset',
  },
  {
    id: 'business-data',
    label: 'Business Data',
    risk: 'BLOCKED',
    destructive: true,
    description: 'Business records reset — BLOCKED',
  },
  {
    id: 'database',
    label: 'Database',
    risk: 'BLOCKED',
    destructive: true,
    description: 'Destructive DB reset — BLOCKED by default',
  },
  {
    id: 'factory',
    label: 'Factory',
    risk: 'BLOCKED',
    destructive: true,
    description: 'Installation-wide factory reset — BLOCKED',
  },
] as const;

@Injectable()
export class ResetEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executors: RepairExecutorsService,
  ) {}

  listScopes(): readonly ResetScope[] {
    return RESET_SCOPES;
  }

  async preview(input: {
    scope: string;
    companyId?: string;
    createdBy?: string;
  }) {
    const scope = this.requireScope(input.scope);
    const previewJson = {
      scope: scope.id,
      risk: scope.risk,
      destructive: scope.destructive,
      dryRun: true,
      impact: scope.description,
      allowed: scope.risk !== 'BLOCKED',
    };

    return this.prisma.repResetExecution.create({
      data: {
        companyId: input.companyId,
        scope: scope.id,
        previewJson: previewJson as Prisma.InputJsonValue,
        status: RepExecutionStatus.DRY_RUN,
        dryRun: true,
        createdBy: input.createdBy,
      },
    });
  }

  async execute(input: {
    scope: string;
    companyId?: string;
    createdBy?: string;
    confirm?: boolean;
  }) {
    const scope = this.requireScope(input.scope);

    if (scope.risk === 'BLOCKED' || scope.destructive) {
      const blocked = await this.prisma.repResetExecution.create({
        data: {
          companyId: input.companyId,
          scope: scope.id,
          previewJson: {
            scope: scope.id,
            risk: scope.risk,
            blocked: true,
            reason: `Reset scope ${scope.id} is BLOCKED for destructive execute`,
          } as Prisma.InputJsonValue,
          status: RepExecutionStatus.BLOCKED,
          dryRun: true,
          resultJson: {
            status: 'BLOCKED',
            reason: `Destructive reset scope '${scope.id}' cannot execute`,
          } as Prisma.InputJsonValue,
          createdBy: input.createdBy,
        },
      });
      throw new RepairException(
        REPAIR_ERROR_CODES.RESET_BLOCKED,
        `Reset scope '${scope.id}' is BLOCKED`,
        HttpStatus.FORBIDDEN,
        { execution: blocked, scope: scope.id },
      );
    }

    // D085/D086: SAFE/LOW only — cache scope applies allowlisted Redis invalidate.
    if (scope.risk !== 'SAFE' && scope.risk !== 'LOW') {
      throw new RepairException(
        REPAIR_ERROR_CODES.RESET_BLOCKED,
        `Reset scope '${scope.id}' risk=${scope.risk} cannot execute (SAFE|LOW only). Preview only.`,
        HttpStatus.FORBIDDEN,
        { scope: scope.id, risk: scope.risk },
      );
    }

    if (scope.id === 'cache') {
      const result = await this.executors.invalidateAllowlistedCache();
      return this.prisma.repResetExecution.create({
        data: {
          companyId: input.companyId,
          scope: scope.id,
          previewJson: {
            scope: scope.id,
            risk: scope.risk,
            dryRun: false,
          } as Prisma.InputJsonValue,
          status: RepExecutionStatus.SUCCEEDED,
          dryRun: false,
          resultJson: {
            status: 'SUCCEEDED',
            actions: result,
            note: 'Allowlisted technical cache invalidated — never FLUSHALL',
          } as Prisma.InputJsonValue,
          createdBy: input.createdBy,
        },
      });
    }

    // technical-temp: purge allowlisted temp via FS executor path (soft).
    if (scope.id === 'technical-temp') {
      const exec = this.executors.require('REP-FS-001');
      const applied = await exec.apply('REP-FS-001');
      return this.prisma.repResetExecution.create({
        data: {
          companyId: input.companyId,
          scope: scope.id,
          previewJson: {
            scope: scope.id,
            risk: scope.risk,
            dryRun: false,
          } as Prisma.InputJsonValue,
          status: RepExecutionStatus.SUCCEEDED,
          dryRun: false,
          resultJson: applied as unknown as Prisma.InputJsonValue,
          createdBy: input.createdBy,
        },
      });
    }

    return this.preview({
      scope: input.scope,
      companyId: input.companyId,
      createdBy: input.createdBy,
    });
  }

  private requireScope(id: string): ResetScope {
    const scope = RESET_SCOPES.find((s) => s.id === id);
    if (!scope) {
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_INPUT,
        `Unknown reset scope: ${id}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return scope;
  }
}

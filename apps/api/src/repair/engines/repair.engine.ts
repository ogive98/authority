import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RepExecutionStatus,
  RepRiskLevel,
} from '@prisma/client';
import { OutboxService } from '../../audit/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RepairScenario } from '../catalogs/scenarios.catalog';
import {
  EXECUTABLE_RISKS,
  REPAIR_AGGREGATE_TYPES,
  REPAIR_ERROR_CODES,
  REPAIR_EVENT_TYPES,
} from '../repair.constants';
import { RepairException } from '../repair.exception';
import { RepairRegistryService } from './registry.service';
import { SnapshotEngine } from './snapshot.engine';
import { VerificationEngine } from './verification.engine';

export interface PlanInput {
  findingId?: string;
  scenarioId?: string;
  companyId?: string;
  actorId?: string;
}

export interface DryRunInput {
  executionId: string;
  actorId?: string;
}

export interface ExecuteInput {
  executionId: string;
  confirm: boolean;
  actorId?: string;
  dryRun?: boolean;
}

@Injectable()
export class RepairEngine {
  private readonly logger = new Logger(RepairEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly registry: RepairRegistryService,
    private readonly snapshots: SnapshotEngine,
    private readonly verification: VerificationEngine,
  ) {}

  async plan(input: PlanInput) {
    const scenario = await this.resolveScenario(input);
    // HIGH/BLOCKED allowed for plan / dry-run only

    const planJson = {
      scenarioId: scenario.id,
      name: scenario.name,
      risk: scenario.risk,
      autoEligible: scenario.autoEligible,
      verification: scenario.verification,
      steps: [
        'APPROVAL',
        'SNAPSHOT',
        'EXECUTE',
        'VERIFY',
        'AUDIT',
        'REPORT',
      ],
      dryRunDefault: true,
      findingId: input.findingId ?? null,
    };

    const risk = scenario.risk as RepRiskLevel;
    const row = await this.prisma.repRepairExecution.create({
      data: {
        companyId: input.companyId,
        findingId: input.findingId,
        scenarioId: scenario.id,
        risk,
        status: RepExecutionStatus.PLANNED,
        dryRun: true,
        planJson: planJson as Prisma.InputJsonValue,
        approvedBy: input.actorId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId: input.companyId,
        aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
        aggregateId: row.id,
        eventType: REPAIR_EVENT_TYPES.PLAN_CREATED,
        payloadJson: {
          executionId: row.id,
          scenarioId: scenario.id,
          risk: scenario.risk,
        },
      });
    });

    return row;
  }

  async dryRun(input: DryRunInput) {
    const row = await this.requireExecution(input.executionId);
    const scenario = this.registry.requireScenario(row.scenarioId);

    const resultJson = {
      mode: 'dry-run',
      scenarioId: scenario.id,
      risk: scenario.risk,
      wouldExecute: EXECUTABLE_RISKS.has(scenario.risk as 'SAFE' | 'LOW'),
      stepsSimulated: ['SNAPSHOT', 'EXECUTE', 'VERIFY'],
      note:
        scenario.risk === 'BLOCKED'
          ? scenario.blockedReason ?? 'BLOCKED — dry-run only'
          : 'No side effects applied',
    };

    const updated = await this.prisma.repRepairExecution.update({
      where: { id: row.id },
      data: {
        status: RepExecutionStatus.DRY_RUN,
        dryRun: true,
        resultJson: resultJson as Prisma.InputJsonValue,
        executedBy: input.actorId,
      },
    });

    return updated;
  }

  async execute(input: ExecuteInput) {
    if (!input.confirm) {
      throw new RepairException(
        REPAIR_ERROR_CODES.CONFIRM_REQUIRED,
        'confirm:true is required to execute a repair',
        HttpStatus.BAD_REQUEST,
      );
    }

    const row = await this.requireExecution(input.executionId);
    const scenario = this.registry.requireScenario(row.scenarioId);

    // dryRun=true (explicit) → simulation only. Otherwise confirm:true applies.
    if (input.dryRun === true) {
      return this.dryRun({
        executionId: input.executionId,
        actorId: input.actorId,
      });
    }

    if (scenario.risk === 'BLOCKED') {
      throw new RepairException(
        REPAIR_ERROR_CODES.RISK_BLOCKED,
        scenario.blockedReason ??
          `Scenario ${scenario.id} is BLOCKED and cannot execute`,
        HttpStatus.FORBIDDEN,
        { scenarioId: scenario.id, risk: scenario.risk },
      );
    }

    // SAFE/LOW execute only when dryRun=false AND risk SAFE|LOW
    if (!EXECUTABLE_RISKS.has(scenario.risk as 'SAFE' | 'LOW')) {
      throw new RepairException(
        REPAIR_ERROR_CODES.RISK_TOO_HIGH,
        `Scenario ${scenario.id} risk=${scenario.risk} is plan/dry-run only (SAFE|LOW required for execute)`,
        HttpStatus.FORBIDDEN,
        { scenarioId: scenario.id, risk: scenario.risk },
      );
    }

    const snapshot = await this.snapshots.create({
      companyId: row.companyId ?? undefined,
      label: `repair:${scenario.id}`,
    });

    await this.prisma.repRepairExecution.update({
      where: { id: row.id },
      data: {
        status: RepExecutionStatus.RUNNING,
        dryRun: false,
        snapshotRef: snapshot.ref,
        executedBy: input.actorId,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId: row.companyId ?? undefined,
        aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
        aggregateId: row.id,
        eventType: REPAIR_EVENT_TYPES.STARTED,
        payloadJson: {
          executionId: row.id,
          scenarioId: scenario.id,
          snapshotRef: snapshot.ref,
        },
      });
    });

    try {
      // Deterministic stub apply — no Redis FLUSHALL, no SQL, no business mutation.
      const applyResult = {
        applied: true,
        scenarioId: scenario.id,
        actions: [`stub:${scenario.name}`],
        sideEffects: 'none',
      };

      const verification = await this.verification.verifyExecution(row.id, {
        stubOk: true,
        expected: scenario.verification,
      });

      const updated = await this.prisma.repRepairExecution.update({
        where: { id: row.id },
        data: {
          status: RepExecutionStatus.SUCCEEDED,
          resultJson: applyResult as Prisma.InputJsonValue,
          verificationJson: verification as Prisma.InputJsonValue,
        },
      });

      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enqueue(tx, {
          companyId: row.companyId ?? undefined,
          aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
          aggregateId: row.id,
          eventType: REPAIR_EVENT_TYPES.COMPLETED,
          payloadJson: {
            executionId: row.id,
            scenarioId: scenario.id,
            status: 'SUCCEEDED',
          },
        });
      });

      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Repair execute failed: ${msg}`);
      await this.prisma.repRepairExecution.update({
        where: { id: row.id },
        data: {
          status: RepExecutionStatus.FAILED,
          resultJson: { error: msg } as Prisma.InputJsonValue,
        },
      });
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enqueue(tx, {
          companyId: row.companyId ?? undefined,
          aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
          aggregateId: row.id,
          eventType: REPAIR_EVENT_TYPES.FAILED,
          payloadJson: { executionId: row.id, error: msg },
        });
      });
      throw err;
    }
  }

  async rollback(executionId: string, actorId?: string) {
    const row = await this.requireExecution(executionId);
    const rollbackJson = {
      rolledBack: true,
      snapshotRef: row.snapshotRef,
      note: 'Stub rollback — no destructive reverse applied',
      actorId: actorId ?? null,
    };

    const updated = await this.prisma.repRepairExecution.update({
      where: { id: row.id },
      data: {
        status: RepExecutionStatus.ROLLED_BACK,
        rollbackJson: rollbackJson as Prisma.InputJsonValue,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await this.outbox.enqueue(tx, {
        companyId: row.companyId ?? undefined,
        aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
        aggregateId: row.id,
        eventType: REPAIR_EVENT_TYPES.ROLLBACK_COMPLETED,
        payloadJson: {
          executionId: row.id,
          snapshotRef: row.snapshotRef,
        },
      });
    });

    return updated;
  }

  private async resolveScenario(input: PlanInput): Promise<RepairScenario> {
    if (input.scenarioId) {
      return this.registry.requireScenario(input.scenarioId);
    }
    if (input.findingId) {
      const finding = await this.prisma.repDiagnosticFinding.findUnique({
        where: { id: input.findingId },
      });
      if (!finding) {
        throw new RepairException(
          REPAIR_ERROR_CODES.NOT_FOUND,
          `Finding not found: ${input.findingId}`,
          HttpStatus.NOT_FOUND,
        );
      }
      const recommended = finding.recommendedJson as
        | { scenarios?: string[] }
        | null;
      const first = recommended?.scenarios?.[0];
      if (first) {
        return this.registry.requireScenario(first);
      }
      if (finding.signatureId) {
        const sig = this.registry.getSignature(finding.signatureId);
        const sid = sig?.scenarios[0];
        if (sid) {
          return this.registry.requireScenario(sid);
        }
      }
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_SCENARIO,
        `No scenario mapped for finding ${input.findingId}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    throw new RepairException(
      REPAIR_ERROR_CODES.INVALID_INPUT,
      'findingId or scenarioId is required',
      HttpStatus.BAD_REQUEST,
    );
  }

  private async requireExecution(id: string) {
    const row = await this.prisma.repRepairExecution.findUnique({
      where: { id },
    });
    if (!row) {
      throw new RepairException(
        REPAIR_ERROR_CODES.NOT_FOUND,
        `Repair execution not found: ${id}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

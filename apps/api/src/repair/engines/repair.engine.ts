import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RepExecutionStatus,
  RepRiskLevel,
} from '@prisma/client';
import { OutboxService } from '../../audit/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RepairScenario } from '../catalogs/scenarios.catalog';
import { RepairExecutorsService } from '../executors/repair-executors.service';
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
    private readonly executors: RepairExecutorsService,
  ) {}

  async plan(input: PlanInput) {
    const scenario = await this.resolveScenario(input);
    // HIGH/BLOCKED allowed for plan / dry-run only

    const hasExecutor = this.executors.hasExecutor(scenario.id);
    const planJson = {
      scenarioId: scenario.id,
      name: scenario.name,
      risk: scenario.risk,
      autoEligible: scenario.autoEligible,
      verification: scenario.verification,
      hasExecutor,
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
          hasExecutor,
        },
      });
    });

    return row;
  }

  async dryRun(input: DryRunInput) {
    const row = await this.requireExecution(input.executionId);
    const scenario = this.registry.requireScenario(row.scenarioId);
    const executable = EXECUTABLE_RISKS.has(
      scenario.risk as 'SAFE' | 'LOW',
    );

    let resultJson: Record<string, unknown>;
    if (scenario.risk === 'BLOCKED') {
      resultJson = {
        mode: 'dry-run',
        scenarioId: scenario.id,
        risk: scenario.risk,
        wouldExecute: false,
        stepsSimulated: ['SNAPSHOT', 'EXECUTE', 'VERIFY'],
        note: scenario.blockedReason ?? 'BLOCKED — dry-run only',
      };
    } else if (executable && this.executors.hasExecutor(scenario.id)) {
      const planned = await this.executors.require(scenario.id).dryRun(
        scenario.id,
      );
      resultJson = {
        ...planned,
        risk: scenario.risk,
        wouldExecute: true,
        stepsSimulated: ['SNAPSHOT', 'EXECUTE', 'VERIFY'],
      };
    } else if (executable) {
      resultJson = {
        mode: 'dry-run',
        scenarioId: scenario.id,
        risk: scenario.risk,
        wouldExecute: false,
        stepsSimulated: ['SNAPSHOT', 'EXECUTE', 'VERIFY'],
        note: 'No allowlisted executor — diagnose/plan only (no stub apply)',
      };
    } else {
      resultJson = {
        mode: 'dry-run',
        scenarioId: scenario.id,
        risk: scenario.risk,
        wouldExecute: false,
        stepsSimulated: ['SNAPSHOT', 'EXECUTE', 'VERIFY'],
        note: 'Risk above SAFE|LOW — plan/dry-run only',
      };
    }

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

    // No magic stub — require allowlisted executor
    const executor = this.executors.require(scenario.id);

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
      const applyResult = await executor.apply(scenario.id);

      const verification = await executor.verify({
        scenarioId: scenario.id,
        expected: scenario.verification,
        applyResult: applyResult as unknown as Record<string, unknown>,
      });

      // Persist via VerificationEngine for consistent shape
      const verificationJson = await this.verification.recordLive(
        row.id,
        verification,
      );

      const updated = await this.prisma.repRepairExecution.update({
        where: { id: row.id },
        data: {
          status: verification.ok
            ? RepExecutionStatus.SUCCEEDED
            : RepExecutionStatus.FAILED,
          resultJson: applyResult as unknown as Prisma.InputJsonValue,
          verificationJson: verificationJson as Prisma.InputJsonValue,
        },
      });

      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enqueue(tx, {
          companyId: row.companyId ?? undefined,
          aggregateType: REPAIR_AGGREGATE_TYPES.EXECUTION,
          aggregateId: row.id,
          eventType: verification.ok
            ? REPAIR_EVENT_TYPES.COMPLETED
            : REPAIR_EVENT_TYPES.FAILED,
          payloadJson: {
            executionId: row.id,
            scenarioId: scenario.id,
            status: updated.status,
            verifyOk: verification.ok,
          },
        });
      });

      if (!verification.ok) {
        throw new RepairException(
          REPAIR_ERROR_CODES.EXECUTOR_FAILED,
          `Repair applied but verification failed for ${scenario.id}`,
          HttpStatus.BAD_GATEWAY,
          { scenarioId: scenario.id, verification },
        );
      }

      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Repair execute failed: ${msg}`);
      if (!(err instanceof RepairException)) {
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
      } else if (err.code !== REPAIR_ERROR_CODES.EXECUTOR_FAILED) {
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
      }
      throw err;
    }
  }

  async rollback(executionId: string, _actorId?: string) {
    const row = await this.requireExecution(executionId);
    // D085: never claim a reverse apply — metadata snapshots are not restorable.
    throw new RepairException(
      REPAIR_ERROR_CODES.EXECUTION_BLOCKED,
      `Rollback BLOCKED for execution ${row.id}: snapshot refs are metadata-only. Use future SOC Recovery (signed artifact + DB backup), never GitHub reinstall.`,
      HttpStatus.FORBIDDEN,
      {
        executionId: row.id,
        snapshotRef: row.snapshotRef,
        restorable: false,
      },
    );
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

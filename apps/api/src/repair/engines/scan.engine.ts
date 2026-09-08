import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  RepFindingSeverity,
  RepFindingState,
  RepRiskLevel,
  RepScanStatus,
} from '@prisma/client';
import { OutboxService } from '../../audit/outbox.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  HealthCheckersService,
  type RawFinding,
} from '../checkers/health-checkers.service';
import {
  REPAIR_AGGREGATE_TYPES,
  REPAIR_ERROR_CODES,
  REPAIR_EVENT_TYPES,
} from '../repair.constants';
import { RepairException } from '../repair.exception';
import { RepairRegistryService } from './registry.service';

export interface RunScanInput {
  depth: string;
  domains?: string[];
  companyId?: string;
  createdBy?: string;
}

@Injectable()
export class ScanEngine {
  private readonly logger = new Logger(ScanEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly checkers: HealthCheckersService,
    private readonly registry: RepairRegistryService,
  ) {}

  async run(input: RunScanInput) {
    const level = this.registry.requireScanLevel(input.depth);
    const domains = input.domains ?? [];
    const checkerIds = [...level.includesCheckers];

    const scan = await this.prisma.repScanExecution.create({
      data: {
        companyId: input.companyId,
        depth: level.id,
        domainsJson: domains as Prisma.InputJsonValue,
        status: RepScanStatus.RUNNING,
        startedAt: new Date(),
        createdBy: input.createdBy,
      },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: REPAIR_AGGREGATE_TYPES.SCAN,
          aggregateId: scan.id,
          eventType: REPAIR_EVENT_TYPES.SCAN_STARTED,
          payloadJson: {
            scanId: scan.id,
            depth: level.id,
            domains,
          },
        });
      });

      const raw = await this.checkers.runForDepth(level.id, {
        domains,
        checkers: checkerIds,
      });
      const findings = [];
      let errorCount = 0;

      for (const rawFinding of raw) {
        const matched = this.matchSignature(rawFinding);
        const severity = this.toSeverity(rawFinding.severity);
        if (
          severity === RepFindingSeverity.ERROR ||
          severity === RepFindingSeverity.CRITICAL
        ) {
          errorCount += 1;
        }

        const risk = matched.risk;
        const recommendedJson = matched.scenarios.length
          ? ({ scenarios: matched.scenarios } as Prisma.InputJsonValue)
          : Prisma.JsonNull;

        const finding = await this.prisma.repDiagnosticFinding.create({
          data: {
            companyId: input.companyId,
            scanId: scan.id,
            component: rawFinding.component,
            category: rawFinding.category,
            severity,
            confidence: rawFinding.confidence,
            signatureId: matched.signatureId,
            evidenceSummary: rawFinding.evidenceSummary,
            evidenceFingerprint: rawFinding.evidenceFingerprint,
            state: RepFindingState.OPEN,
            repairability: matched.scenarios.length ? 'catalog' : 'unknown',
            recommendedJson,
            risk,
          },
        });
        findings.push(finding);

        await this.upsertIncident({
          companyId: input.companyId,
          fingerprint: rawFinding.evidenceFingerprint,
          severity,
          signatureId: matched.signatureId,
          title: rawFinding.evidenceSummary.slice(0, 200),
        });

        if (severity !== RepFindingSeverity.INFO) {
          await this.prisma.$transaction(async (tx) => {
            await this.outbox.enqueue(tx, {
              companyId: input.companyId,
              aggregateType: REPAIR_AGGREGATE_TYPES.FINDING,
              aggregateId: finding.id,
              eventType: REPAIR_EVENT_TYPES.FINDING_DETECTED,
              payloadJson: {
                findingId: finding.id,
                scanId: scan.id,
                signatureId: matched.signatureId,
                severity,
              },
            });
          });
        }
      }

      const completed = await this.prisma.repScanExecution.update({
        where: { id: scan.id },
        data: {
          status: RepScanStatus.COMPLETED,
          completedAt: new Date(),
          findingCount: findings.length,
          errorCount,
          summaryJson: {
            depth: level.id,
            domains,
            checkers: checkerIds,
            findingCount: findings.length,
            errorCount,
          } as Prisma.InputJsonValue,
        },
        include: { findings: true },
      });

      await this.prisma.$transaction(async (tx) => {
        await this.outbox.enqueue(tx, {
          companyId: input.companyId,
          aggregateType: REPAIR_AGGREGATE_TYPES.SCAN,
          aggregateId: scan.id,
          eventType: REPAIR_EVENT_TYPES.SCAN_COMPLETED,
          payloadJson: {
            scanId: scan.id,
            findingCount: findings.length,
            errorCount,
            depth: level.id,
          },
        });
      });

      return completed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Scan ${scan.id} failed: ${msg}`);
      await this.prisma.repScanExecution.update({
        where: { id: scan.id },
        data: {
          status: RepScanStatus.FAILED,
          completedAt: new Date(),
          summaryJson: { error: msg } as Prisma.InputJsonValue,
        },
      });
      if (err instanceof RepairException) {
        throw err;
      }
      throw new RepairException(
        REPAIR_ERROR_CODES.INVALID_INPUT,
        `Scan failed: ${msg}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private matchSignature(raw: RawFinding): {
    signatureId: string | null;
    scenarios: string[];
    risk: RepRiskLevel;
  } {
    const byCandidate = raw.signatureCandidate
      ? this.registry.getSignature(raw.signatureCandidate)
      : undefined;
    const byComponent =
      byCandidate ?? this.registry.matchSignatureByComponent(raw.component);

    if (!byComponent) {
      return {
        signatureId:
          raw.severity === 'INFO' ? null : 'UNKNOWN_ERROR_V1',
        scenarios: [],
        risk: RepRiskLevel.NONE,
      };
    }

    const scenarios = [...byComponent.scenarios];
    let risk: RepRiskLevel = RepRiskLevel.NONE;
    for (const sid of scenarios) {
      const sc = this.registry.getScenario(sid);
      if (!sc) continue;
      risk = this.maxRisk(risk, sc.risk as RepRiskLevel);
    }

    return {
      signatureId: byComponent.id,
      scenarios,
      risk,
    };
  }

  private maxRisk(a: RepRiskLevel, b: RepRiskLevel): RepRiskLevel {
    const order: RepRiskLevel[] = [
      RepRiskLevel.NONE,
      RepRiskLevel.SAFE,
      RepRiskLevel.LOW,
      RepRiskLevel.MEDIUM,
      RepRiskLevel.HIGH,
      RepRiskLevel.BLOCKED,
    ];
    return order.indexOf(b) > order.indexOf(a) ? b : a;
  }

  private toSeverity(s: RawFinding['severity']): RepFindingSeverity {
    switch (s) {
      case 'INFO':
        return RepFindingSeverity.INFO;
      case 'WARN':
        return RepFindingSeverity.WARN;
      case 'ERROR':
        return RepFindingSeverity.ERROR;
      case 'CRITICAL':
        return RepFindingSeverity.CRITICAL;
      default:
        return RepFindingSeverity.WARN;
    }
  }

  private async upsertIncident(input: {
    companyId?: string;
    fingerprint: string;
    severity: RepFindingSeverity;
    signatureId: string | null;
    title: string;
  }) {
    const existing = await this.prisma.repDiagnosticIncident.findFirst({
      where: { fingerprint: input.fingerprint },
    });
    if (existing) {
      return this.prisma.repDiagnosticIncident.update({
        where: { id: existing.id },
        data: {
          count: { increment: 1 },
          lastSeenAt: new Date(),
          severity: input.severity,
          signatureId: input.signatureId ?? existing.signatureId,
          status: RepFindingState.OPEN,
        },
      });
    }
    return this.prisma.repDiagnosticIncident.create({
      data: {
        companyId: input.companyId,
        fingerprint: input.fingerprint,
        severity: input.severity,
        signatureId: input.signatureId,
        title: input.title,
        status: RepFindingState.OPEN,
      },
    });
  }
}

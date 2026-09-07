import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthCheckersService } from './checkers/health-checkers.service';
import { MaintenanceEngine } from './engines/maintenance.engine';
import { RepairEngine } from './engines/repair.engine';
import { RepairRegistryService } from './engines/registry.service';
import { ReportingEngine } from './engines/reporting.engine';
import { ResetEngine } from './engines/reset.engine';
import { ScanEngine, type RunScanInput } from './engines/scan.engine';
import { SnapshotEngine } from './engines/snapshot.engine';
import { VerificationEngine } from './engines/verification.engine';
import { REPAIR_PIPELINE_STAGES } from './repair.constants';

@Injectable()
export class RepairFacade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RepairRegistryService,
    private readonly checkers: HealthCheckersService,
    private readonly scanEngine: ScanEngine,
    private readonly repairEngine: RepairEngine,
    private readonly resetEngine: ResetEngine,
    private readonly snapshotEngine: SnapshotEngine,
    private readonly verificationEngine: VerificationEngine,
    private readonly reportingEngine: ReportingEngine,
    private readonly maintenanceEngine: MaintenanceEngine,
  ) {}

  async dashboard(companyId?: string) {
    const where = companyId ? { companyId } : {};
    const [
      openFindings,
      openIncidents,
      recentScans,
      recentExecutions,
      reportStatus,
    ] = await Promise.all([
      this.prisma.repDiagnosticFinding.count({
        where: { ...where, state: 'OPEN' },
      }),
      this.prisma.repDiagnosticIncident.count({
        where: { ...where, status: 'OPEN' },
      }),
      this.prisma.repScanExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.repRepairExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.reportingEngine.status(),
    ]);

    return {
      health: openFindings > 0 ? 'degraded' : 'ok',
      lastScanId: recentScans[0]?.id ?? null,
      openFindings,
      openIncidents,
      pendingRepairs: recentExecutions.filter(
        (e) =>
          e.status === 'PLANNED' ||
          e.status === 'DRY_RUN' ||
          e.status === 'APPROVED',
      ).length,
      reportingQueued: reportStatus.queued ?? 0,
      pipeline: REPAIR_PIPELINE_STAGES,
      recentScans,
      recentExecutions,
      reporting: reportStatus,
      scenarios: this.registry.listScenarios().length,
      signatures: this.registry.listSignatures().length,
      scanLevels: this.registry.listScanLevels(),
    };
  }

  async health() {
    const findings = await this.checkers.runL0L1({
      checkers: ['postgres', 'redis', 'outbox', 'module-catalog'],
    });
    const unhealthy = findings.filter(
      (f) => f.severity === 'ERROR' || f.severity === 'CRITICAL',
    );
    return {
      status: unhealthy.length === 0 ? 'ok' : 'degraded',
      findings,
      checkedAt: new Date().toISOString(),
    };
  }

  async runScan(input: RunScanInput) {
    const completed = await this.scanEngine.run(input);
    return {
      scan: {
        id: completed.id,
        status: completed.status,
        findingCount: completed.findingCount,
        depth: completed.depth,
        errorCount: completed.errorCount,
      },
      findings: (completed.findings ?? []).map((f) => ({
        id: f.id,
        component: f.component,
        severity: f.severity,
        signatureId: f.signatureId,
        evidenceSummary: f.evidenceSummary,
        risk: f.risk,
      })),
    };
  }

  listFindings(opts?: { companyId?: string; take?: number }) {
    return this.prisma.repDiagnosticFinding.findMany({
      where: opts?.companyId ? { companyId: opts.companyId } : undefined,
      orderBy: { lastSeenAt: 'desc' },
      take: opts?.take ?? 100,
    });
  }

  listIncidents(opts?: { companyId?: string; take?: number }) {
    return this.prisma.repDiagnosticIncident.findMany({
      where: opts?.companyId ? { companyId: opts.companyId } : undefined,
      orderBy: { lastSeenAt: 'desc' },
      take: opts?.take ?? 100,
    });
  }

  listIssues(opts?: { companyId?: string; take?: number }) {
    return this.listFindings({
      companyId: opts?.companyId,
      take: opts?.take ?? 100,
    });
  }

  plan(input: {
    findingId?: string;
    scenarioId?: string;
    companyId?: string;
    actorId?: string;
  }) {
    return this.repairEngine.plan(input);
  }

  execute(input: {
    executionId: string;
    confirm: boolean;
    actorId?: string;
    dryRun?: boolean;
  }) {
    return this.repairEngine.execute(input);
  }

  dryRun(input: { executionId: string; actorId?: string }) {
    return this.repairEngine.dryRun(input);
  }

  rollback(executionId: string, actorId?: string) {
    return this.repairEngine.rollback(executionId, actorId);
  }

  listResetScopes() {
    return this.resetEngine.listScopes();
  }

  resetPreview(input: {
    scope: string;
    companyId?: string;
    createdBy?: string;
  }) {
    return this.resetEngine.preview(input);
  }

  resetExecute(input: {
    scope: string;
    companyId?: string;
    createdBy?: string;
    confirm?: boolean;
  }) {
    return this.resetEngine.execute(input);
  }

  createSnapshot(input?: { companyId?: string; label?: string }) {
    return this.snapshotEngine.create(input);
  }

  listBackups() {
    return this.snapshotEngine.list();
  }

  verify(executionId: string) {
    return this.verificationEngine.verify(executionId);
  }

  listAudit(opts?: { companyId?: string; take?: number }) {
    return this.prisma.repRepairExecution.findMany({
      where: opts?.companyId ? { companyId: opts.companyId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 50,
    });
  }

  maintenance() {
    return this.maintenanceEngine.status();
  }

  reportingStatus() {
    return this.reportingEngine.status();
  }

  reportingFlush(limit?: number) {
    return this.reportingEngine.flush(limit);
  }

  queueReport(input: {
    companyId?: string;
    reportType: string;
    payload: unknown;
  }) {
    return this.reportingEngine.queueReport(input);
  }
}

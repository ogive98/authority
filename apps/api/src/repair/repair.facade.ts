import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { BackupService } from '../backup/backup.service';
import { AuthService } from '../identity/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { HealthCheckersService } from './checkers/health-checkers.service';
import { MaintenanceEngine } from './engines/maintenance.engine';
import { RecoveryEngine } from './engines/recovery.engine';
import { RepairEngine } from './engines/repair.engine';
import { RepairRegistryService } from './engines/registry.service';
import { ReportingEngine } from './engines/reporting.engine';
import { ResetEngine } from './engines/reset.engine';
import { ScanEngine, type RunScanInput } from './engines/scan.engine';
import { SnapshotEngine } from './engines/snapshot.engine';
import { VerificationEngine } from './engines/verification.engine';
import { REPAIR_ERROR_CODES, REPAIR_PIPELINE_STAGES, EXECUTABLE_RISKS } from './repair.constants';
import { RepairException } from './repair.exception';
import { RepairExecutorsService } from './executors/repair-executors.service';
import { REPAIR_SCENARIOS } from './catalogs/scenarios.catalog';

@Injectable()
export class RepairFacade {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly registry: RepairRegistryService,
    private readonly checkers: HealthCheckersService,
    private readonly scanEngine: ScanEngine,
    private readonly repairEngine: RepairEngine,
    private readonly resetEngine: ResetEngine,
    private readonly snapshotEngine: SnapshotEngine,
    private readonly verificationEngine: VerificationEngine,
    private readonly reportingEngine: ReportingEngine,
    private readonly maintenanceEngine: MaintenanceEngine,
    private readonly recoveryEngine: RecoveryEngine,
    private readonly executors: RepairExecutorsService,
    @Optional() private readonly backupService?: BackupService,
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
      coverage: this.coverage(),
    };
  }

  coverage() {
    const executableIds = new Set(this.executors.listExecutableScenarioIds());
    const scenarios = REPAIR_SCENARIOS;
    const byRisk = {
      SAFE: scenarios.filter((s) => s.risk === 'SAFE'),
      LOW: scenarios.filter((s) => s.risk === 'LOW'),
      MEDIUM: scenarios.filter((s) => s.risk === 'MEDIUM'),
      HIGH: scenarios.filter((s) => s.risk === 'HIGH'),
      BLOCKED: scenarios.filter((s) => s.risk === 'BLOCKED'),
    };
    const safeLow = [...byRisk.SAFE, ...byRisk.LOW];
    const executableSafeLow = safeLow.filter((s) => executableIds.has(s.id));
    const planOnlySafeLow = safeLow.filter((s) => !executableIds.has(s.id));
    return {
      totalScenarios: scenarios.length,
      executableCount: executableIds.size,
      executableIds: [...executableIds],
      safeLowTotal: safeLow.length,
      safeLowExecutable: executableSafeLow.length,
      safeLowPlanOnly: planOnlySafeLow.map((s) => s.id),
      blockedCount: byRisk.BLOCKED.length,
      mediumHighPlanOnly: byRisk.MEDIUM.length + byRisk.HIGH.length,
      completeAllowedSurface:
        planOnlySafeLow.length === 0 &&
        executableSafeLow.every((s) =>
          EXECUTABLE_RISKS.has(s.risk as 'SAFE' | 'LOW'),
        ),
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

  async execute(input: {
    executionId: string;
    confirm: boolean;
    actorId?: string;
    dryRun?: boolean;
    password?: string;
  }) {
    // Live execute requires session password step-up (pack SECURITY).
    if (input.confirm && input.dryRun !== true) {
      if (!input.actorId || !input.password?.trim()) {
        throw new RepairException(
          REPAIR_ERROR_CODES.REAUTH_REQUIRED,
          'Session password is required for live repair execute.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      await this.auth.verifyCurrentPassword({
        userId: input.actorId,
        password: input.password,
      });
    }
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

  async resetExecute(input: {
    scope: string;
    companyId?: string;
    createdBy?: string;
    confirm?: boolean;
    password?: string;
    confirmPhrase?: string;
  }) {
    if (input.confirm) {
      if (!input.createdBy || !input.password?.trim()) {
        throw new RepairException(
          REPAIR_ERROR_CODES.REAUTH_REQUIRED,
          'Session password is required for reset execute.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (input.confirmPhrase !== 'CONFIRM') {
        throw new RepairException(
          REPAIR_ERROR_CODES.CONFIRM_REQUIRED,
          'Typed confirmation CONFIRM is required for reset execute.',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.auth.verifyCurrentPassword({
        userId: input.createdBy,
        password: input.password,
      });
    }
    return this.resetEngine.execute(input);
  }

  async createSnapshot(input?: {
    companyId?: string;
    label?: string;
    actorUserId?: string;
  }) {
    if (input?.companyId && this.backupService) {
      const created = await this.backupService.createBackup({
        companyId: input.companyId,
        actorUserId: input.actorUserId,
        label: input.label ?? 'repair-pre-action',
        scope: 'CONFIGURATION',
      });
      return {
        ref: created.id,
        kind: 'metadata-only' as const,
        companyId: created.companyId,
        label: created.label ?? undefined,
        createdAt: created.createdAt,
        restorable: false as const,
        note: 'Delegated to Backup module (D304) — manifest-only, not installable.',
        backupId: created.id,
      };
    }
    return this.snapshotEngine.create(input);
  }

  listBackups() {
    return this.snapshotEngine.list();
  }

  recoveryPolicies() {
    return this.recoveryEngine.policies();
  }

  createRecoveryManifest(input?: { companyId?: string; label?: string }) {
    return this.recoveryEngine.createManifestBookmark(input);
  }

  /** Explicit refuse — never restore from metadata bookmarks. */
  restoreSnapshot(ref: string): never {
    return this.snapshotEngine.restore(ref);
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

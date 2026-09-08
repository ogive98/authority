import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis.service';
import { STATIC_MODULE_MANIFESTS } from '../../modules-registry/catalog/manifests';
import { PERMISSION_CATALOGUE } from '../../permissions/permission.constants';
import { LICENSE_CACHE_KEY } from '../../license/license.constants';
import {
  REPAIR_OUTBOX_LAG_MS,
  REPAIR_STUCK_EXECUTION_MS,
} from '../repair.constants';
import type { ScanDepthId } from '../catalogs/scan-levels.catalog';
import {
  expandDomainTags,
  type RawFinding,
  type RawFindingSeverity,
  type RepairCheckerDef,
} from './checker.types';

export type { RawFinding, RawFindingSeverity } from './checker.types';

export function fingerprint(
  component: string,
  category: string,
  summary: string,
): string {
  return createHash('sha256')
    .update(`${component}|${category}|${summary}`)
    .digest('hex')
    .slice(0, 40);
}

/**
 * Registry-first health checkers (L0–L4).
 * No giant switch in ScanEngine — selection is by depth × domains.
 */
@Injectable()
export class HealthCheckersService {
  private readonly logger = new Logger(HealthCheckersService.name);
  private readonly registry: readonly RepairCheckerDef[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    this.registry = this.buildRegistry();
  }

  listCheckerIds(): string[] {
    return this.registry.map((c) => c.id);
  }

  async runForDepth(
    depth: ScanDepthId,
    opts?: { domains?: readonly string[]; checkers?: readonly string[] },
  ): Promise<RawFinding[]> {
    const wantedIds = opts?.checkers?.length
      ? new Set(opts.checkers)
      : null;
    const domainTags =
      opts?.domains && opts.domains.length > 0
        ? expandDomainTags(opts.domains)
        : null;

    const selected = this.registry.filter((c) => {
      if (!c.depths.includes(depth)) return false;
      if (wantedIds && !wantedIds.has(c.id)) return false;
      if (!domainTags) return true;
      if (c.domains.length === 0) return true;
      return c.domains.some((d) => domainTags.has(d.toLowerCase()));
    });

    const findings: RawFinding[] = [];
    for (const checker of selected) {
      try {
        findings.push(...(await checker.run()));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Checker ${checker.id} failed: ${msg}`);
        findings.push({
          component: checker.id,
          category: 'checker',
          severity: 'WARN',
          confidence: 'UNKNOWN',
          evidenceSummary: `Checker ${checker.id} failed: ${msg}`,
          evidenceFingerprint: fingerprint(checker.id, 'checker', 'fail'),
        });
      }
    }
    return findings;
  }

  /** @deprecated Prefer runForDepth — kept for facade health() */
  async runL0L1(opts?: {
    checkers?: readonly string[];
  }): Promise<RawFinding[]> {
    return this.runForDepth('L1', { checkers: opts?.checkers });
  }

  private buildRegistry(): readonly RepairCheckerDef[] {
    return [
      // ── L0+ ──────────────────────────────────────────
      {
        id: 'postgres',
        depths: ['L0', 'L1', 'L2', 'L3', 'L4'],
        domains: ['runtime', 'l0', 'data', 'l3', 'database', 'postgres'],
        run: () => this.checkPostgres(),
      },
      {
        id: 'redis',
        depths: ['L0', 'L1', 'L2', 'L3', 'L4'],
        domains: ['runtime', 'l0', 'connectors', 'l4', 'redis'],
        run: () => this.checkRedis(),
      },
      // ── L1+ ──────────────────────────────────────────
      {
        id: 'outbox',
        depths: ['L1', 'L2', 'L3', 'L4'],
        domains: ['kernel', 'l1', 'thunder', 'outbox'],
        run: () => this.checkOutboxLag(),
      },
      {
        id: 'module-catalog',
        depths: ['L1', 'L2', 'L3', 'L4'],
        domains: ['module', 'l2', 'catalog', 'licence', 'license', 'l5'],
        run: () => this.checkModuleCatalog(),
      },
      // ── L2+ structural ───────────────────────────────
      {
        id: 'prisma-migrations',
        depths: ['L2', 'L3', 'L4'],
        domains: ['data', 'l3', 'database', 'runtime'],
        run: () => this.checkPrismaMigrations(),
      },
      {
        id: 'manifest-structure',
        depths: ['L2', 'L3', 'L4'],
        domains: ['module', 'l2', 'catalog'],
        run: () => this.checkManifestStructure(),
      },
      {
        id: 'thunder-job-queues',
        depths: ['L2', 'L3', 'L4'],
        domains: ['kernel', 'l1', 'runtime', 'connectors'],
        run: () => this.checkThunderJobQueues(),
      },
      {
        id: 'env-presence',
        depths: ['L2', 'L3', 'L4'],
        domains: ['runtime', 'l0', 'connectors'],
        run: () => this.checkEnvPresence(),
      },
      // ── L3+ integrity ────────────────────────────────
      {
        id: 'capability-permission',
        depths: ['L3', 'L4'],
        domains: ['module', 'l2', 'licence', 'license'],
        run: () => this.checkCapabilityPermissionConsistency(),
      },
      {
        id: 'stuck-repair-executions',
        depths: ['L3', 'L4'],
        domains: ['kernel', 'module', 'data'],
        run: () => this.checkStuckRepairExecutions(),
      },
      {
        id: 'findings-company-isolation',
        depths: ['L3', 'L4'],
        domains: ['data', 'l3', 'module'],
        run: () => this.checkFindingsCompanyIsolation(),
      },
      {
        id: 'dlq-pressure',
        depths: ['L3', 'L4'],
        domains: ['kernel', 'l1', 'thunder'],
        run: () => this.checkDlqPressure(),
      },
      // ── L4 slice (not full ERP audit) ────────────────
      {
        id: 'permission-catalog',
        depths: ['L4'],
        domains: ['module', 'licence', 'license', 'l5'],
        run: () => this.checkPermissionCatalog(),
      },
      {
        id: 'license-cache-readonly',
        depths: ['L4'],
        domains: ['licence', 'license', 'l5', 'connectors'],
        run: () => this.checkLicenseCacheReadonly(),
      },
    ];
  }

  private async checkPostgres(): Promise<RawFinding[]> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return [
        {
          component: 'postgres',
          category: 'liveness',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: 'PostgreSQL SELECT 1 succeeded',
          evidenceFingerprint: fingerprint('postgres', 'liveness', 'ok'),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Postgres liveness failed: ${msg}`);
      return [
        {
          component: 'postgres-prisma',
          category: 'database',
          severity: 'CRITICAL',
          confidence: 'CERTAIN',
          evidenceSummary: `PostgreSQL unavailable: ${msg}`,
          evidenceFingerprint: fingerprint(
            'postgres-prisma',
            'database',
            'unavailable',
          ),
          signatureCandidate: 'MIGRATION_MISMATCH_V1',
        },
      ];
    }
  }

  private async checkRedis(): Promise<RawFinding[]> {
    if (!this.redis.isConfigured()) {
      return [
        {
          component: 'redis',
          category: 'redis',
          severity: 'WARN',
          confidence: 'PROBABLE',
          evidenceSummary:
            'REDIS_URL not set — Redis client check skipped',
          evidenceFingerprint: fingerprint('redis', 'redis', 'url-missing'),
          signatureCandidate: 'REDIS_UNAVAILABLE_V1',
        },
      ];
    }

    const ok = await this.redis.ping();
    if (ok) {
      return [
        {
          component: 'redis',
          category: 'redis',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: 'Redis PING → PONG',
          evidenceFingerprint: fingerprint('redis', 'redis', 'ping-ok'),
        },
      ];
    }

    return [
      {
        component: 'redis',
        category: 'redis',
        severity: 'ERROR',
        confidence: 'CERTAIN',
        evidenceSummary: 'Redis configured but PING failed',
        evidenceFingerprint: fingerprint('redis', 'redis', 'ping-fail'),
        signatureCandidate: 'REDIS_UNAVAILABLE_V1',
      },
    ];
  }

  private async checkOutboxLag(): Promise<RawFinding[]> {
    try {
      const cutoff = new Date(Date.now() - REPAIR_OUTBOX_LAG_MS);
      const lagCount = await this.prisma.coreOutbox.count({
        where: {
          publishedAt: null,
          createdAt: { lt: cutoff },
        },
      });

      if (lagCount === 0) {
        return [
          {
            component: 'core-outbox',
            category: 'thunder',
            severity: 'INFO',
            confidence: 'CERTAIN',
            evidenceSummary: 'No pending core_outbox older than 5 minutes',
            evidenceFingerprint: fingerprint(
              'core-outbox',
              'thunder',
              'lag-ok',
            ),
          },
        ];
      }

      return [
        {
          component: 'core-outbox',
          category: 'thunder',
          severity: 'WARN',
          confidence: 'CERTAIN',
          evidenceSummary: `${lagCount} unpublished core_outbox row(s) older than 5 minutes`,
          evidenceFingerprint: fingerprint(
            'core-outbox',
            'thunder',
            `lag-${lagCount}`,
          ),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'core-outbox',
          category: 'thunder',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `Outbox lag check skipped: ${msg}`,
          evidenceFingerprint: fingerprint('core-outbox', 'thunder', 'skip'),
        },
      ];
    }
  }

  private checkModuleCatalog(): Promise<RawFinding[]> {
    try {
      const count = STATIC_MODULE_MANIFESTS.length;
      return Promise.resolve([
        {
          component: 'module-catalog',
          category: 'module',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: `STATIC_MODULE_MANIFESTS count=${count}`,
          evidenceFingerprint: fingerprint(
            'module-catalog',
            'module',
            `count-${count}`,
          ),
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return Promise.resolve([
        {
          component: 'module-catalog',
          category: 'module',
          severity: 'WARN',
          confidence: 'UNKNOWN',
          evidenceSummary: `Module catalog check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'module-catalog',
            'module',
            'skip',
          ),
        },
      ]);
    }
  }

  private async checkPrismaMigrations(): Promise<RawFinding[]> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ failed: bigint | number }>
      >`
        SELECT COUNT(*)::int AS failed
        FROM "_prisma_migrations"
        WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL
      `;
      const failed = Number(rows[0]?.failed ?? 0);
      if (failed === 0) {
        return [
          {
            component: 'prisma-migrations',
            category: 'database',
            severity: 'INFO',
            confidence: 'CERTAIN',
            evidenceSummary: 'No unfinished/rolled-back Prisma migrations',
            evidenceFingerprint: fingerprint(
              'prisma-migrations',
              'database',
              'ok',
            ),
          },
        ];
      }
      return [
        {
          component: 'postgres-prisma',
          category: 'database',
          severity: 'ERROR',
          confidence: 'CERTAIN',
          evidenceSummary: `${failed} unfinished or rolled-back Prisma migration(s)`,
          evidenceFingerprint: fingerprint(
            'postgres-prisma',
            'database',
            `mig-fail-${failed}`,
          ),
          signatureCandidate: 'MIGRATION_MISMATCH_V1',
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'prisma-migrations',
          category: 'database',
          severity: 'WARN',
          confidence: 'UNKNOWN',
          evidenceSummary: `Migration table check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'prisma-migrations',
            'database',
            'skip',
          ),
        },
      ];
    }
  }

  private checkManifestStructure(): Promise<RawFinding[]> {
    const issues: string[] = [];
    for (const m of STATIC_MODULE_MANIFESTS) {
      if (!m.id) issues.push('missing-id');
      if (!m.capabilities?.length) issues.push(`${m.id}:no-capabilities`);
      if (!m.permissions?.length) issues.push(`${m.id}:no-permissions`);
    }
    if (issues.length === 0) {
      return Promise.resolve([
        {
          component: 'manifest-structure',
          category: 'module',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: `${STATIC_MODULE_MANIFESTS.length} manifests structurally valid`,
          evidenceFingerprint: fingerprint(
            'manifest-structure',
            'module',
            'ok',
          ),
        },
      ]);
    }
    return Promise.resolve([
      {
        component: 'manifest-structure',
        category: 'module',
        severity: 'WARN',
        confidence: 'CERTAIN',
        evidenceSummary: `Manifest structure issues: ${issues.slice(0, 5).join(', ')}`,
        evidenceFingerprint: fingerprint(
          'manifest-structure',
          'module',
          issues.join('|').slice(0, 80),
        ),
      },
    ]);
  }

  private async checkThunderJobQueues(): Promise<RawFinding[]> {
    try {
      const [pending, running, failed] = await Promise.all([
        this.prisma.thunderJob.count({ where: { status: 'PENDING' } }),
        this.prisma.thunderJob.count({ where: { status: 'RUNNING' } }),
        this.prisma.thunderJob.count({ where: { status: 'FAILED' } }),
      ]);
      const severity: RawFindingSeverity =
        failed > 20 ? 'WARN' : failed > 0 ? 'INFO' : 'INFO';
      return [
        {
          component: 'bullmq-worker',
          category: 'queue',
          severity,
          confidence: 'CERTAIN',
          evidenceSummary: `Thunder jobs PENDING=${pending} RUNNING=${running} FAILED=${failed}`,
          evidenceFingerprint: fingerprint(
            'bullmq-worker',
            'queue',
            `p${pending}-r${running}-f${failed}`,
          ),
          signatureCandidate:
            failed > 50 ? 'WORKER_STALLED_V1' : undefined,
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'bullmq-worker',
          category: 'queue',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `Job queue check skipped: ${msg}`,
          evidenceFingerprint: fingerprint('bullmq-worker', 'queue', 'skip'),
        },
      ];
    }
  }

  private checkEnvPresence(): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];
    const hasDb = Boolean(process.env.DATABASE_URL?.trim());
    const hasRedis = Boolean(process.env.REDIS_URL?.trim());
    findings.push({
      component: 'env-presence',
      category: 'config',
      severity: hasDb ? 'INFO' : 'CRITICAL',
      confidence: 'CERTAIN',
      evidenceSummary: hasDb
        ? 'DATABASE_URL present (value not logged)'
        : 'DATABASE_URL missing',
      evidenceFingerprint: fingerprint(
        'env-presence',
        'config',
        hasDb ? 'db-ok' : 'db-missing',
      ),
    });
    findings.push({
      component: 'env-presence',
      category: 'config',
      severity: hasRedis ? 'INFO' : 'WARN',
      confidence: 'CERTAIN',
      evidenceSummary: hasRedis
        ? 'REDIS_URL present (value not logged)'
        : 'REDIS_URL missing',
      evidenceFingerprint: fingerprint(
        'env-presence',
        'config',
        hasRedis ? 'redis-ok' : 'redis-missing',
      ),
      signatureCandidate: hasRedis ? undefined : 'REDIS_UNAVAILABLE_V1',
    });
    return Promise.resolve(findings);
  }

  private checkCapabilityPermissionConsistency(): Promise<RawFinding[]> {
    const catalogue = new Set<string>(PERMISSION_CATALOGUE);
    const missing: string[] = [];
    for (const m of STATIC_MODULE_MANIFESTS) {
      for (const cap of m.capabilities ?? []) {
        if (cap.permissionKey && !catalogue.has(cap.permissionKey)) {
          missing.push(`${m.id}:${cap.permissionKey}`);
        }
      }
    }
    if (missing.length === 0) {
      return Promise.resolve([
        {
          component: 'capability-permission',
          category: 'module',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary:
            'All manifest capability permissionKeys exist in PERMISSION_CATALOGUE',
          evidenceFingerprint: fingerprint(
            'capability-permission',
            'module',
            'ok',
          ),
        },
      ]);
    }
    return Promise.resolve([
      {
        component: 'capability-permission',
        category: 'module',
        severity: 'WARN',
        confidence: 'CERTAIN',
        evidenceSummary: `${missing.length} capability permissionKey(s) missing from catalogue (e.g. ${missing.slice(0, 3).join(', ')})`,
        evidenceFingerprint: fingerprint(
          'capability-permission',
          'module',
          missing.slice(0, 5).join('|'),
        ),
      },
    ]);
  }

  private async checkStuckRepairExecutions(): Promise<RawFinding[]> {
    try {
      const cutoff = new Date(Date.now() - REPAIR_STUCK_EXECUTION_MS);
      const stuck = await this.prisma.repRepairExecution.count({
        where: {
          status: 'RUNNING',
          updatedAt: { lt: cutoff },
        },
      });
      if (stuck === 0) {
        return [
          {
            component: 'repair-executions',
            category: 'integrity',
            severity: 'INFO',
            confidence: 'CERTAIN',
            evidenceSummary: 'No repair executions stuck in RUNNING',
            evidenceFingerprint: fingerprint(
              'repair-executions',
              'integrity',
              'ok',
            ),
          },
        ];
      }
      return [
        {
          component: 'repair-executions',
          category: 'integrity',
          severity: 'WARN',
          confidence: 'CERTAIN',
          evidenceSummary: `${stuck} repair execution(s) stuck RUNNING > 15m`,
          evidenceFingerprint: fingerprint(
            'repair-executions',
            'integrity',
            `stuck-${stuck}`,
          ),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'repair-executions',
          category: 'integrity',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `Stuck execution check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'repair-executions',
            'integrity',
            'skip',
          ),
        },
      ];
    }
  }

  private async checkFindingsCompanyIsolation(): Promise<RawFinding[]> {
    try {
      const orphan = await this.prisma.repDiagnosticFinding.count({
        where: { companyId: null },
      });
      return [
        {
          component: 'findings-isolation',
          category: 'integrity',
          severity: orphan > 0 ? 'INFO' : 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary:
            orphan > 0
              ? `${orphan} finding(s) without companyId (report-only — no mutation)`
              : 'All findings scoped to a companyId',
          evidenceFingerprint: fingerprint(
            'findings-isolation',
            'integrity',
            `orphan-${orphan}`,
          ),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'findings-isolation',
          category: 'integrity',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `Isolation check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'findings-isolation',
            'integrity',
            'skip',
          ),
        },
      ];
    }
  }

  private async checkDlqPressure(): Promise<RawFinding[]> {
    try {
      const count = await this.prisma.thunderDlqEntry.count();
      return [
        {
          component: 'thunder-dlq',
          category: 'thunder',
          severity: count > 10 ? 'WARN' : 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: `Thunder DLQ entries=${count}`,
          evidenceFingerprint: fingerprint(
            'thunder-dlq',
            'thunder',
            `dlq-${count}`,
          ),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'thunder-dlq',
          category: 'thunder',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `DLQ check skipped: ${msg}`,
          evidenceFingerprint: fingerprint('thunder-dlq', 'thunder', 'skip'),
        },
      ];
    }
  }

  private checkPermissionCatalog(): Promise<RawFinding[]> {
    const count = PERMISSION_CATALOGUE.length;
    return Promise.resolve([
      {
        component: 'permission-catalog',
        category: 'security',
        severity: 'INFO',
        confidence: 'CERTAIN',
        evidenceSummary: `PERMISSION_CATALOGUE size=${count} (read-only audit)`,
        evidenceFingerprint: fingerprint(
          'permission-catalog',
          'security',
          `count-${count}`,
        ),
      },
    ]);
  }

  private async checkLicenseCacheReadonly(): Promise<RawFinding[]> {
    if (!this.redis.isConfigured()) {
      return [
        {
          component: 'license-cache',
          category: 'licence',
          severity: 'INFO',
          confidence: 'PROBABLE',
          evidenceSummary: 'License cache check skipped — Redis not configured',
          evidenceFingerprint: fingerprint(
            'license-cache',
            'licence',
            'no-redis',
          ),
        },
      ];
    }
    try {
      const cached = await this.redis.getJson<unknown>(LICENSE_CACHE_KEY);
      return [
        {
          component: 'license-cache',
          category: 'licence',
          severity: 'INFO',
          confidence: 'CERTAIN',
          evidenceSummary: cached
            ? `License cache key present (${LICENSE_CACHE_KEY}) — read-only`
            : `License cache key absent (${LICENSE_CACHE_KEY}) — read-only`,
          evidenceFingerprint: fingerprint(
            'license-cache',
            'licence',
            cached ? 'hit' : 'miss',
          ),
        },
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
        {
          component: 'license-cache',
          category: 'licence',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `License cache check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'license-cache',
            'licence',
            'skip',
          ),
        },
      ];
    }
  }
}

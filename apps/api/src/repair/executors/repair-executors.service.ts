import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis.service';
import { WatchdogService } from '../../thunder-core/resources/watchdog.service';
import { STATIC_MODULE_MANIFESTS } from '../../modules-registry/catalog/manifests';
import {
  REPAIR_ERROR_CODES,
  REPAIR_REDIS_ALLOWLIST_EXACT,
  REPAIR_REDIS_ALLOWLIST_PREFIXES,
} from '../repair.constants';
import { RepairException } from '../repair.exception';
import { SnapshotEngine } from '../engines/snapshot.engine';
import type {
  ExecutorApplyResult,
  ExecutorDryRunResult,
  ExecutorVerifyContext,
  ExecutorVerifyResult,
  RepairExecutor,
} from './executor.types';

/**
 * Allowlisted SAFE/LOW executors — registry-first (D086 complete ALLOWED surface).
 * No FLUSHALL, arbitrary SQL, business mutation, GitHub, or OS kill.
 */
@Injectable()
export class RepairExecutorsService {
  private readonly logger = new Logger(RepairExecutorsService.name);
  private readonly byScenario = new Map<string, RepairExecutor>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly watchdog: WatchdogService,
    private readonly snapshots: SnapshotEngine,
  ) {
    for (const executor of this.buildExecutors()) {
      for (const id of executor.scenarioIds) {
        this.byScenario.set(id, executor);
      }
    }
  }

  hasExecutor(scenarioId: string): boolean {
    return this.byScenario.has(scenarioId);
  }

  listExecutableScenarioIds(): string[] {
    return [...this.byScenario.keys()].sort();
  }

  require(scenarioId: string): RepairExecutor {
    const executor = this.byScenario.get(scenarioId);
    if (!executor) {
      throw new RepairException(
        REPAIR_ERROR_CODES.NO_EXECUTOR,
        `Scenario ${scenarioId} has no allowlisted executor — diagnose/plan only`,
        HttpStatus.BAD_REQUEST,
        { scenarioId },
      );
    }
    return executor;
  }

  /** Shared by Reset scope `cache`. */
  async invalidateAllowlistedCache(): Promise<{
    exactDeleted: number;
    prefixDeleted: number;
  }> {
    if (!this.redis.isConfigured()) {
      return { exactDeleted: 0, prefixDeleted: 0 };
    }
    const exactDeleted = await this.redis.delExactKeys([
      ...REPAIR_REDIS_ALLOWLIST_EXACT,
    ]);
    let prefixDeleted = 0;
    for (const prefix of REPAIR_REDIS_ALLOWLIST_PREFIXES) {
      const result = await this.redis.delByPrefix(prefix, 200);
      prefixDeleted += result.deleted;
    }
    return { exactDeleted, prefixDeleted };
  }

  private buildExecutors(): RepairExecutor[] {
    return [
      this.redisNamespaceInvalidate(),
      this.redisReconnect(),
      this.dbPoolReconnect(),
      this.workerHeartbeatRecover(),
      this.moduleRegistryRefresh(),
      this.diagnoseReport(),
      this.safeTempAndLogs(),
      this.snapshotMetadata(),
      this.permissionCacheRefresh(),
    ];
  }

  private redisNamespaceInvalidate(): RepairExecutor {
    const scenarioIds = [
      'REP-REDIS-001',
      'REP-REDIS-002',
      'REP-PERF-001',
      'REP-PERF-002',
      'REP-API-003',
      'REP-DB-005',
      'REP-CONFIG-004',
      'REP-MODULE-003',
      'REP-SEARCH-002',
      'REP-TENANT-001',
      'REP-RUNTIME-003',
      'REP-RUNTIME-004',
      'REP-SEC-002',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          `DEL exact: ${REPAIR_REDIS_ALLOWLIST_EXACT.join(', ')}`,
          `SCAN+DEL prefixes: ${REPAIR_REDIS_ALLOWLIST_PREFIXES.join(', ')}`,
          'Never FLUSHALL / BullMQ / business keys',
        ],
        note: 'Targeted technical cache invalidation',
      }),
      apply: async (scenarioId) => {
        const { exactDeleted, prefixDeleted } =
          await this.invalidateAllowlistedCache();
        return {
          applied: true,
          scenarioId,
          actions: [
            `del-exact:${exactDeleted}`,
            `del-prefix:${prefixDeleted}`,
          ],
          sideEffects: 'technical-cache-only',
          details: {
            redisConfigured: this.redis.isConfigured(),
            exactDeleted,
            prefixDeleted,
          },
        };
      },
      verify: async (ctx) => this.verifyRedisPing(ctx, 'cache-invalidated'),
    };
  }

  private redisReconnect(): RepairExecutor {
    const scenarioIds = [
      'REP-REDIS-003',
      'REP-REDIS-004',
      'REP-API-001',
      'REP-NOTIF-002',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: ['redis.reconnect()', 'redis.ping()'],
        note: 'Soft reconnect — no FLUSH',
      }),
      apply: async (scenarioId) => {
        if (!this.redis.isConfigured()) {
          return {
            applied: true,
            scenarioId,
            actions: ['redis-not-configured-noop'],
            sideEffects: 'none',
            details: { redisConfigured: false, ping: false },
          };
        }
        const ok = await this.redis.reconnect();
        if (!ok) {
          throw new RepairException(
            REPAIR_ERROR_CODES.EXECUTOR_FAILED,
            'Redis reconnect failed — PING did not return PONG',
            HttpStatus.BAD_GATEWAY,
            { scenarioId },
          );
        }
        return {
          applied: true,
          scenarioId,
          actions: ['redis-reconnect', 'redis-ping-ok'],
          sideEffects: 'connection-refresh',
          details: { ping: true },
        };
      },
      verify: async (ctx) => this.verifyRedisPing(ctx, 'redis-ping-ok'),
    };
  }

  private dbPoolReconnect(): RepairExecutor {
    const scenarioIds = [
      'REP-DB-001',
      'REP-DB-002',
      'REP-API-004',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          'prisma.$disconnect()',
          'prisma.$connect()',
          'SELECT 1',
        ],
        note: 'Refresh Prisma pool — no arbitrary SQL',
      }),
      apply: async (scenarioId) => {
        await this.prisma.$disconnect();
        await this.prisma.$connect();
        await this.prisma.$queryRaw`SELECT 1`;
        return {
          applied: true,
          scenarioId,
          actions: ['prisma-disconnect', 'prisma-connect', 'select-1'],
          sideEffects: 'connection-pool-refresh',
          details: { select1: true },
        };
      },
      verify: async (ctx) => {
        const checkedAt = new Date().toISOString();
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return {
            ok: true,
            expected: ctx.expected,
            checkedAt,
            mode: 'live',
            detail: { select1: true },
            note: 'db-select-1-ok',
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            ok: false,
            expected: ctx.expected,
            checkedAt,
            mode: 'live',
            detail: { error: msg },
            note: 'db-select-1-failed',
          };
        }
      },
    };
  }

  private workerHeartbeatRecover(): RepairExecutor {
    const scenarioIds = [
      'REP-WORKER-001',
      'REP-WORKER-002',
      'REP-RUNTIME-001',
      'REP-RUNTIME-002',
      'REP-NOTIF-001',
      'REP-SCHED-002',
      'REP-QUEUE-003',
      'REP-NOTIF-004',
      'REP-SYNC-002',
      'REP-SYNC-003',
      'REP-DOC-003',
      'REP-DOC-004',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          'WatchdogService.scanOnce() — requeue stalled idempotent jobs',
        ],
        note: 'Soft recover — no OS process kill',
      }),
      apply: async (scenarioId) => {
        const handled = await this.watchdog.scanOnce(50);
        this.logger.log(
          `Watchdog recover handled=${handled} scenario=${scenarioId}`,
        );
        return {
          applied: true,
          scenarioId,
          actions: [`watchdog-scanOnce:handled=${handled}`],
          sideEffects: 'stalled-job-requeue',
          details: { handled },
        };
      },
      verify: async (ctx) => {
        const checkedAt = new Date().toISOString();
        const apply = ctx.applyResult as {
          details?: { handled?: number };
        } | null;
        return {
          ok: true,
          expected: ctx.expected,
          checkedAt,
          mode: 'live',
          detail: { handled: apply?.details?.handled ?? null },
          note: 'heartbeat-restored-or-noop',
        };
      },
    };
  }

  private moduleRegistryRefresh(): RepairExecutor {
    const scenarioIds = [
      'REP-MODULE-001',
      'REP-MODULE-002',
      'REP-MODULE-004',
      'REP-API-002',
      'REP-WORKER-003',
      'REP-CONFIG-001',
      'REP-CONFIG-003',
      'REP-SCHED-001',
      'REP-SCHED-003',
      'REP-SYNC-001',
      'REP-TENANT-002',
      'REP-SEARCH-003',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          'Re-read static module manifests',
          'Count mod_module_state rows',
          'Optional invalidate authority:repair:tech:capability:*',
        ],
        note: 'Registry reconcile — no module enable/disable mutation',
      }),
      apply: async (scenarioId) => {
        const manifestCount = STATIC_MODULE_MANIFESTS.length;
        const stateCount = await this.prisma.modModuleState.count();
        let cache = { exactDeleted: 0, prefixDeleted: 0 };
        if (this.redis.isConfigured()) {
          cache = await this.invalidateAllowlistedCache();
        }
        return {
          applied: true,
          scenarioId,
          actions: [
            `manifests:${manifestCount}`,
            `module-states:${stateCount}`,
            `cache-prefix-del:${cache.prefixDeleted}`,
          ],
          sideEffects: 'registry-metadata-refresh',
          details: { manifestCount, stateCount, cache },
        };
      },
      verify: async (ctx) => {
        const checkedAt = new Date().toISOString();
        const manifestCount = STATIC_MODULE_MANIFESTS.length;
        return {
          ok: manifestCount > 0,
          expected: ctx.expected,
          checkedAt,
          mode: 'live',
          detail: { manifestCount },
          note: 'registry-fresh',
        };
      },
    };
  }

  /** Report-only SAFE diagnostics — no mutation. */
  private diagnoseReport(): RepairExecutor {
    const scenarioIds = [
      'REP-DB-007',
      'REP-REDIS-005',
      'REP-QUEUE-001',
      'REP-QUEUE-004',
      'REP-FS-006',
      'REP-PERF-004',
      'REP-TENANT-003',
      'REP-NOTIF-003',
      'REP-SYNC-004',
      'REP-BACKUP-001',
      'REP-BACKUP-002',
      'REP-BACKUP-003',
      'REP-DOC-001',
      'REP-DOC-002',
      'REP-SEARCH-001',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: ['Collect technical diagnostic report (RO)'],
        note: 'Diagnose-only — no mutation',
      }),
      apply: async (scenarioId) => {
        const report = await this.buildDiagnosticReport(scenarioId);
        return {
          applied: true,
          scenarioId,
          actions: ['diagnostic-report'],
          sideEffects: 'none',
          details: report,
        };
      },
      verify: async (ctx) => ({
        ok: true,
        expected: ctx.expected,
        checkedAt: new Date().toISOString(),
        mode: 'live',
        detail: { reportPresent: Boolean(ctx.applyResult) },
        note: 'diagnostic-report-available',
      }),
    };
  }

  private safeTempAndLogs(): RepairExecutor {
    const scenarioIds = [
      'REP-FS-001',
      'REP-FS-002',
      'REP-FS-003',
      'REP-RUNTIME-005',
      'REP-PERF-003',
      'REP-FS-004',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          `Only under ${this.safeTempRoot()}`,
          'Delete *.tmp older than 24h / rotate *.log > 5MB',
        ],
        note: 'Allowlisted temp dir only — never arbitrary paths',
      }),
      apply: async (scenarioId) => {
        const root = this.safeTempRoot();
        await fs.mkdir(root, { recursive: true });
        const { deleted, rotated, files } = await this.purgeSafeTemp(root);
        return {
          applied: true,
          scenarioId,
          actions: [`deleted:${deleted}`, `rotated:${rotated}`],
          sideEffects: 'temp-dir-only',
          details: { root, deleted, rotated, sample: files.slice(0, 20) },
        };
      },
      verify: async (ctx) => {
        const root = this.safeTempRoot();
        let exists = false;
        try {
          await fs.access(root);
          exists = true;
        } catch {
          exists = false;
        }
        return {
          ok: true,
          expected: ctx.expected,
          checkedAt: new Date().toISOString(),
          mode: 'live',
          detail: { root, exists },
          note: 'temp-runtime-cleared-or-ready',
        };
      },
    };
  }

  private snapshotMetadata(): RepairExecutor {
    const scenarioIds = [
      'REP-SNAPSHOT-001',
      'REP-SNAPSHOT-002',
    ] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: ['Create/validate metadata-only snapshot bookmark'],
        note: 'Not installable SOC backup — restorable:false',
      }),
      apply: async (scenarioId) => {
        if (scenarioId === 'REP-SNAPSHOT-001') {
          const items = this.snapshots.list(5);
          return {
            applied: true,
            scenarioId,
            actions: [`listed:${items.length}`],
            sideEffects: 'none',
            details: {
              count: items.length,
              restorable: false,
              items: items.map((i) => ({
                ref: i.ref,
                kind: i.kind,
                restorable: i.restorable,
              })),
            },
          };
        }
        const snap = await this.snapshots.create({
          label: 'repair-approved-meta',
        });
        return {
          applied: true,
          scenarioId,
          actions: [`created:${snap.ref}`],
          sideEffects: 'metadata-bookmark',
          details: {
            ref: snap.ref,
            kind: snap.kind,
            restorable: snap.restorable,
            note: snap.note,
          },
        };
      },
      verify: async (ctx) => ({
        ok: true,
        expected: ctx.expected,
        checkedAt: new Date().toISOString(),
        mode: 'live' as const,
        detail: (ctx.applyResult?.details ?? {}) as Record<string, unknown>,
        note: 'snapshot-metadata-ok',
      }),
    };
  }

  private permissionCacheRefresh(): RepairExecutor {
    const scenarioIds = ['REP-SEC-001'] as const;

    return {
      scenarioIds,
      dryRun: async (scenarioId) => ({
        mode: 'dry-run',
        scenarioId,
        wouldApply: true,
        plannedActions: [
          'Invalidate authority:repair:tech:perm:* / session meta prefixes',
        ],
        note: 'Permission cache technical keys only',
      }),
      apply: async (scenarioId) => {
        const result = await this.invalidateAllowlistedCache();
        return {
          applied: true,
          scenarioId,
          actions: [
            `del-exact:${result.exactDeleted}`,
            `del-prefix:${result.prefixDeleted}`,
          ],
          sideEffects: 'technical-cache-only',
          details: result,
        };
      },
      verify: async (ctx) =>
        this.verifyRedisPing(ctx, 'permission-cache-fresh'),
    };
  }

  private async buildDiagnosticReport(scenarioId: string) {
    const [outboxLag, stuck, moduleStates] = await Promise.all([
      this.prisma.coreOutbox.count({
        where: {
          publishedAt: null,
          createdAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
        },
      }),
      this.prisma.repRepairExecution.count({
        where: {
          status: 'RUNNING',
          updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
        },
      }),
      this.prisma.modModuleState.count(),
    ]);
    const redisConfigured = this.redis.isConfigured();
    const ping = redisConfigured ? await this.redis.ping() : false;
    const mem = process.memoryUsage();
    return {
      scenarioId,
      fingerprint: createHash('sha256')
        .update(`${scenarioId}|${outboxLag}|${stuck}`)
        .digest('hex')
        .slice(0, 16),
      outboxLagCount: outboxLag,
      stuckExecutions: stuck,
      moduleStates,
      redisConfigured,
      redisPing: ping,
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      tmpRoot: this.safeTempRoot(),
      generatedAt: new Date().toISOString(),
    };
  }

  private safeTempRoot(): string {
    return path.join(os.tmpdir(), 'authority-repair');
  }

  private async purgeSafeTemp(root: string): Promise<{
    deleted: number;
    rotated: number;
    files: string[];
  }> {
    let deleted = 0;
    let rotated = 0;
    const files: string[] = [];
    let entries: string[] = [];
    try {
      entries = await fs.readdir(root);
    } catch {
      return { deleted: 0, rotated: 0, files: [] };
    }
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const name of entries) {
      if (name.includes('..') || name.includes('/') || name.includes('\\')) {
        continue;
      }
      const full = path.join(root, name);
      files.push(name);
      try {
        const st = await fs.stat(full);
        if (!st.isFile()) continue;
        if (name.endsWith('.tmp') && st.mtimeMs < cutoff) {
          await fs.unlink(full);
          deleted += 1;
          continue;
        }
        if (name.endsWith('.log') && st.size > 5 * 1024 * 1024) {
          await fs.rename(full, `${full}.${Date.now()}.bak`);
          rotated += 1;
        }
      } catch {
        /* skip */
      }
    }
    return { deleted, rotated, files };
  }

  private async verifyRedisPing(
    ctx: ExecutorVerifyContext,
    note: string,
  ): Promise<ExecutorVerifyResult> {
    const checkedAt = new Date().toISOString();
    if (!this.redis.isConfigured()) {
      return {
        ok: true,
        expected: ctx.expected,
        checkedAt,
        mode: 'live',
        note: `${note} · redis-not-configured`,
        detail: { redisConfigured: false },
      };
    }
    const ping = await this.redis.ping();
    return {
      ok: ping,
      expected: ctx.expected,
      checkedAt,
      mode: 'live',
      note,
      detail: { ping },
    };
  }
}

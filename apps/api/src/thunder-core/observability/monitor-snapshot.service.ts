import { Injectable } from '@nestjs/common';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AdmissionOrchestratorService } from '../admission/admission-orchestrator.service';
import { CircuitBreakerService } from '../resilience/circuit-breaker.service';
import { ResourceManagerService } from '../resources/resource-manager.service';
import {
  THUNDER_QUEUE_FAMILIES,
  thunderWorkersEnabled,
} from '../thunder.constants';
import type { ThunderMonitorSnapshot } from './monitor-snapshot.types';

@Injectable()
export class MonitorSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly resources: ResourceManagerService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly admission: AdmissionOrchestratorService,
  ) {}

  async snapshot(): Promise<ThunderMonitorSnapshot> {
    const asOf = new Date().toISOString();
    const [
      jobGroups,
      dlq,
      outboxLagStats,
      publishedLastMinute,
      redisOk,
      redisMemory,
      dbOk,
      breakers,
    ] = await Promise.all([
      this.prisma.thunderJob.groupBy({
        by: ['status', 'queue'],
        _count: { _all: true },
      }),
      this.prisma.thunderDlqEntry.count(),
      this.queryOutboxLagStats(),
      this.prisma.coreOutbox.count({
        where: {
          publishedAt: { gte: new Date(Date.now() - 60_000) },
        },
      }),
      this.redis.ping(),
      this.redis.getUsedMemoryBytes(),
      this.pingDb(),
      this.circuitBreaker.listBreakers(),
    ]);

    const outboxLag = outboxLagStats.unpublished;

    const jobs = {
      pending: 0,
      running: 0,
      failed: 0,
      completed: 0,
      cancelled: 0,
      pausedByModule: 0,
      dlq,
    };

    const queueMap = new Map<
      string,
      {
        family: string;
        pending: number;
        running: number;
        failed: number;
        pausedByModule: number;
      }
    >();

    for (const family of THUNDER_QUEUE_FAMILIES) {
      queueMap.set(family, {
        family,
        pending: 0,
        running: 0,
        failed: 0,
        pausedByModule: 0,
      });
    }

    for (const row of jobGroups) {
      const count = row._count._all;
      switch (row.status) {
        case 'PENDING':
          jobs.pending += count;
          break;
        case 'RUNNING':
          jobs.running += count;
          break;
        case 'FAILED':
          jobs.failed += count;
          break;
        case 'COMPLETED':
          jobs.completed += count;
          break;
        case 'CANCELLED':
          jobs.cancelled += count;
          break;
        case 'PAUSED_BY_MODULE':
          jobs.pausedByModule += count;
          break;
        default:
          break;
      }

      const q = queueMap.get(row.queue) ?? {
        family: row.queue,
        pending: 0,
        running: 0,
        failed: 0,
        pausedByModule: 0,
      };
      if (row.status === 'PENDING') q.pending += count;
      if (row.status === 'RUNNING') q.running += count;
      if (row.status === 'FAILED') q.failed += count;
      if (row.status === 'PAUSED_BY_MODULE') q.pausedByModule += count;
      queueMap.set(row.queue, q);
    }

    const cpuCores = cpus().length || 1;
    const loadAvg1 = loadavg()[0] ?? 0;
    const live = this.resources.getLiveSample();
    const usageRatio =
      live?.cpuUsageRatio ??
      (process.platform === 'win32'
        ? null
        : Math.min(1, Math.max(0, loadAvg1 / cpuCores)));

    const totalBytes = totalmem();
    const freeBytes = freemem();
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const processRssBytes = process.memoryUsage().rss;

    const pressure = this.resources.getPressure();
    const pgPool = Number(process.env.THUNDER_PG_POOL_USAGE ?? '');
    const apiP95 = Number(process.env.THUNDER_API_P95_MS ?? '');

    return {
      schemaVersion: 1,
      asOf,
      cpu: {
        usageRatio,
        loadAvg1: process.platform === 'win32' ? null : loadAvg1,
        cores: cpuCores,
      },
      ram: {
        usedBytes,
        totalBytes,
        usageRatio: totalBytes > 0 ? usedBytes / totalBytes : 0,
        processRssBytes,
      },
      workers: {
        enabled: thunderWorkersEnabled(),
        queues: THUNDER_QUEUE_FAMILIES.map((family) => ({
          family,
          concurrency: this.resources.getConcurrency(family),
        })),
      },
      queues: [...queueMap.values()],
      jobs,
      events: {
        outboxLag,
        outboxLagSeconds: {
          oldest: outboxLagStats.oldest,
          p50: outboxLagStats.p50,
          p95: outboxLagStats.p95,
          p99: outboxLagStats.p99,
        },
        publishedLastMinute,
        eventsPerSecondEstimate: publishedLastMinute / 60,
      },
      breakers: breakers.map((b) => ({
        dependencyKey: b.dependencyKey,
        state: b.state,
        stateGauge: breakerStateGauge(b.state),
        failures: b.failures,
        openedAt: b.openedAt,
      })),
      admission: (() => {
        const rejects = this.admission.getRejectSnapshot();
        return {
          rejectTotal: rejects.total,
          rejectByReason: rejects.byReason,
        };
      })(),
      db: {
        ok: dbOk,
        poolUsageRatio: Number.isFinite(pgPool) ? pgPool : null,
      },
      redis: {
        configured: this.redis.isConfigured(),
        ok: redisOk,
        usedMemoryBytes: redisMemory,
      },
      api: {
        p95Ms: Number.isFinite(apiP95) && apiP95 > 0 ? apiP95 : null,
      },
      pressure: {
        shedP4: pressure.shedP4,
        reason: pressure.reason,
      },
      systemMode: (process.env.AUTHORITY_SYSTEM_MODE ?? 'NORMAL').toUpperCase(),
    };
  }

  private async pingDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async queryOutboxLagStats(): Promise<{
    unpublished: number;
    oldest: number | null;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  }> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          unpublished: number | bigint;
          oldest: number | null;
          p50: number | null;
          p95: number | null;
          p99: number | null;
        }>
      >`
        SELECT
          COUNT(*)::int AS unpublished,
          EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::float8 AS oldest,
          percentile_cont(0.50) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (NOW() - created_at))
          )::float8 AS p50,
          percentile_cont(0.95) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (NOW() - created_at))
          )::float8 AS p95,
          percentile_cont(0.99) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (NOW() - created_at))
          )::float8 AS p99
        FROM core_outbox
        WHERE published_at IS NULL
      `;
      const row = rows[0];
      if (!row) {
        return {
          unpublished: 0,
          oldest: null,
          p50: null,
          p95: null,
          p99: null,
        };
      }
      const unpublished = Number(row.unpublished);
      return {
        unpublished: Number.isFinite(unpublished) ? unpublished : 0,
        oldest: toFiniteOrNull(row.oldest),
        p50: toFiniteOrNull(row.p50),
        p95: toFiniteOrNull(row.p95),
        p99: toFiniteOrNull(row.p99),
      };
    } catch {
      const unpublished = await this.prisma.coreOutbox.count({
        where: { publishedAt: null },
      });
      return {
        unpublished,
        oldest: null,
        p50: null,
        p95: null,
        p99: null,
      };
    }
  }
}

function toFiniteOrNull(value: number | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function breakerStateGauge(state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): 0 | 1 | 2 {
  if (state === 'OPEN') {
    return 1;
  }
  if (state === 'HALF_OPEN') {
    return 2;
  }
  return 0;
}

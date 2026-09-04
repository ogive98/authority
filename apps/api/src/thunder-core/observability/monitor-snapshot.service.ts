import { Injectable } from '@nestjs/common';
import { cpus, freemem, loadavg, totalmem } from 'node:os';
import { RedisService } from '../../infrastructure/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
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
  ) {}

  async snapshot(): Promise<ThunderMonitorSnapshot> {
    const asOf = new Date().toISOString();
    const [
      jobGroups,
      dlq,
      outboxLag,
      publishedLastMinute,
      redisOk,
      redisMemory,
      dbOk,
    ] = await Promise.all([
      this.prisma.thunderJob.groupBy({
        by: ['status', 'queue'],
        _count: { _all: true },
      }),
      this.prisma.thunderDlqEntry.count(),
      this.prisma.coreOutbox.count({ where: { publishedAt: null } }),
      this.prisma.coreOutbox.count({
        where: {
          publishedAt: { gte: new Date(Date.now() - 60_000) },
        },
      }),
      this.redis.ping(),
      this.redis.getUsedMemoryBytes(),
      this.pingDb(),
    ]);

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
        publishedLastMinute,
        eventsPerSecondEstimate: publishedLastMinute / 60,
      },
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
}

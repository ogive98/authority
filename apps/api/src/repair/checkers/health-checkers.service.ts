import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { STATIC_MODULE_MANIFESTS } from '../../modules-registry/catalog/manifests';
import { REPAIR_OUTBOX_LAG_MS } from '../repair.constants';

export type RawFindingSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface RawFinding {
  component: string;
  category: string;
  severity: RawFindingSeverity;
  confidence: string;
  evidenceSummary: string;
  evidenceFingerprint: string;
  signatureCandidate?: string;
}

function fingerprint(
  component: string,
  category: string,
  summary: string,
): string {
  return createHash('sha256')
    .update(`${component}|${category}|${summary}`)
    .digest('hex')
    .slice(0, 40);
}

@Injectable()
export class HealthCheckersService {
  private readonly logger = new Logger(HealthCheckersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runL0L1(opts?: {
    checkers?: readonly string[];
  }): Promise<RawFinding[]> {
    const wanted = new Set(
      opts?.checkers ?? ['postgres', 'redis', 'outbox', 'module-catalog'],
    );
    const findings: RawFinding[] = [];

    if (wanted.has('postgres')) {
      findings.push(...(await this.checkPostgres()));
    }
    if (wanted.has('redis')) {
      findings.push(...(await this.checkRedis()));
    }
    if (wanted.has('outbox')) {
      findings.push(...(await this.checkOutboxLag()));
    }
    if (wanted.has('module-catalog')) {
      findings.push(...this.checkModuleCatalog());
    }

    return findings;
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
          evidenceFingerprint: fingerprint(
            'postgres',
            'liveness',
            'ok',
          ),
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
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      return [
        {
          component: 'redis',
          category: 'redis',
          severity: 'WARN',
          confidence: 'PROBABLE',
          evidenceSummary:
            'REDIS_URL not set — Redis client check skipped (INFO)',
          evidenceFingerprint: fingerprint('redis', 'redis', 'url-missing'),
          signatureCandidate: 'REDIS_UNAVAILABLE_V1',
        },
      ];
    }

    // No shared Redis client injected in Repair — presence-only check.
    return [
      {
        component: 'redis',
        category: 'redis',
        severity: 'INFO',
        confidence: 'PROBABLE',
        evidenceSummary: 'REDIS_URL present — live ping deferred (no client)',
        evidenceFingerprint: fingerprint('redis', 'redis', 'url-present'),
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
      this.logger.warn(`Outbox lag check skipped: ${msg}`);
      return [
        {
          component: 'core-outbox',
          category: 'thunder',
          severity: 'INFO',
          confidence: 'UNKNOWN',
          evidenceSummary: `Outbox lag check skipped: ${msg}`,
          evidenceFingerprint: fingerprint(
            'core-outbox',
            'thunder',
            'skip',
          ),
        },
      ];
    }
  }

  private checkModuleCatalog(): RawFinding[] {
    try {
      const count = STATIC_MODULE_MANIFESTS.length;
      return [
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
      ];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return [
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
      ];
    }
  }
}

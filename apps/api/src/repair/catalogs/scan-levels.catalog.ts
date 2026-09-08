export type ScanDepthId = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export interface ScanLevel {
  id: ScanDepthId;
  name: string;
  depth: string;
  description: string;
  includesCheckers: readonly string[];
}

/** Embedded from pack catalogs/scan-levels.yml */
export const SCAN_LEVELS: readonly ScanLevel[] = [
  {
    id: 'L0',
    name: 'instant',
    depth: 'liveness',
    description: 'Postgres / Redis liveness only',
    includesCheckers: ['postgres', 'redis'],
  },
  {
    id: 'L1',
    name: 'quick',
    depth: 'operational',
    description: 'L0 plus outbox lag and module catalog',
    includesCheckers: ['postgres', 'redis', 'outbox', 'module-catalog'],
  },
  {
    id: 'L2',
    name: 'deep',
    depth: 'structural',
    description:
      'Structural: migrations, manifests, job queues, env presence',
    includesCheckers: [
      'postgres',
      'redis',
      'outbox',
      'module-catalog',
      'prisma-migrations',
      'manifest-structure',
      'thunder-job-queues',
      'env-presence',
    ],
  },
  {
    id: 'L3',
    name: 'integrity',
    depth: 'forensic-integrity',
    description:
      'Integrity: capability/permission, stuck executions, isolation, DLQ',
    includesCheckers: [
      'postgres',
      'redis',
      'outbox',
      'module-catalog',
      'prisma-migrations',
      'manifest-structure',
      'thunder-job-queues',
      'env-presence',
      'capability-permission',
      'stuck-repair-executions',
      'findings-company-isolation',
      'dlq-pressure',
    ],
  },
  {
    id: 'L4',
    name: 'full-authority-audit',
    depth: 'full',
    description:
      'L3 plus permission catalogue + license cache read-only (slice, not full ERP)',
    includesCheckers: [
      'postgres',
      'redis',
      'outbox',
      'module-catalog',
      'prisma-migrations',
      'manifest-structure',
      'thunder-job-queues',
      'env-presence',
      'capability-permission',
      'stuck-repair-executions',
      'findings-company-isolation',
      'dlq-pressure',
      'permission-catalog',
      'license-cache-readonly',
    ],
  },
] as const;

export const SCAN_LEVELS_BY_ID: ReadonlyMap<ScanDepthId, ScanLevel> = new Map(
  SCAN_LEVELS.map((l) => [l.id, l]),
);

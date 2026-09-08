export type SignatureConfidence = 'CERTAIN' | 'PROBABLE' | 'UNKNOWN';

export interface ErrorSignature {
  id: string;
  component: string;
  confidence: SignatureConfidence;
  scenarios: readonly string[];
  category?: string;
  description?: string;
}

/** Embedded from pack catalogs/error-signatures.yml */
export const ERROR_SIGNATURES: readonly ErrorSignature[] = [
  {
    id: 'WORKER_STALLED_V1',
    component: 'bullmq-worker',
    confidence: 'CERTAIN',
    scenarios: ['REP-WORKER-001', 'REP-WORKER-002'],
    category: 'worker',
    description: 'Worker heartbeat stalled or process unhealthy',
  },
  {
    id: 'CACHE_NAMESPACE_CORRUPT_V1',
    component: 'redis-cache',
    confidence: 'CERTAIN',
    scenarios: ['REP-REDIS-001', 'REP-REDIS-002'],
    category: 'cache',
    description: 'Targeted cache namespace corrupted or inconsistent',
  },
  {
    id: 'REDIS_UNAVAILABLE_V1',
    component: 'redis',
    confidence: 'PROBABLE',
    scenarios: ['REP-REDIS-003'],
    category: 'redis',
    description: 'Redis client unreachable or REDIS_URL missing',
  },
  {
    id: 'MIGRATION_MISMATCH_V1',
    component: 'postgres-prisma',
    confidence: 'CERTAIN',
    scenarios: ['REP-DB-003', 'REP-DB-008'],
    category: 'database',
    description: 'Prisma migration state mismatch',
  },
  {
    id: 'BACKUP_INVALID_V1',
    component: 'backup',
    confidence: 'CERTAIN',
    scenarios: ['REP-BACKUP-001', 'REP-BACKUP-002'],
    category: 'backup',
    description: 'Backup artifact invalid or unreadable',
  },
  {
    id: 'DB_POOL_STALE_V1',
    component: 'postgres',
    confidence: 'PROBABLE',
    scenarios: ['REP-DB-001', 'REP-DB-002'],
    category: 'database',
    description: 'Stale Prisma/Postgres connection pool',
  },
  {
    id: 'MODULE_REGISTRY_STALE_V1',
    component: 'module-registry',
    confidence: 'PROBABLE',
    scenarios: ['REP-MODULE-001', 'REP-MODULE-003'],
    category: 'module',
    description: 'Module registry or capability cache stale',
  },
  {
    id: 'OUTBOX_LAG_V1',
    component: 'outbox',
    confidence: 'PROBABLE',
    scenarios: ['REP-QUEUE-001', 'REP-QUEUE-004'],
    category: 'queue',
    description: 'Outbox/queue lag or stalled technical jobs',
  },
  {
    id: 'UNKNOWN_ERROR_V1',
    component: 'any',
    confidence: 'UNKNOWN',
    scenarios: [],
    category: 'unknown',
    description: 'Unmatched diagnostic signal',
  },
] as const;

export const ERROR_SIGNATURES_BY_ID: ReadonlyMap<string, ErrorSignature> =
  new Map(ERROR_SIGNATURES.map((s) => [s.id, s]));

export const ERROR_SIGNATURES_BY_COMPONENT: ReadonlyMap<
  string,
  ErrorSignature
> = new Map(
  ERROR_SIGNATURES.filter((s) => s.component !== 'any').map((s) => [
    s.component,
    s,
  ]),
);

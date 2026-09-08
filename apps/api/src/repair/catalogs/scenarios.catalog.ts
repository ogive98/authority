export type ScenarioRisk =
  | 'SAFE'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'BLOCKED';

export type AutoEligible = boolean | 'policy-controlled';

export interface RepairScenario {
  id: string;
  name: string;
  risk: ScenarioRisk;
  autoEligible: AutoEligible;
  verification: string;
  domain: string;
  description?: string;
  blockedReason?: string;
  backup?: 'none' | 'recommended' | 'REQUIRED';
}

function s(
  id: string,
  name: string,
  risk: ScenarioRisk,
  autoEligible: AutoEligible,
  verification: string,
  domain: string,
  extras?: Partial<RepairScenario>,
): RepairScenario {
  return { id, name, risk, autoEligible, verification, domain, ...extras };
}

/**
 * Full scenario catalog from pack docs/08-repair-scenario-catalog.md
 * + explicit BLOCKED markers (FLUSHALL / blind replay / business mutation).
 */
export const REPAIR_SCENARIOS: readonly RepairScenario[] = [
  // Runtime
  s('REP-RUNTIME-001', 'restart-unhealthy-worker', 'LOW', 'policy-controlled', 'worker-heartbeat-restored', 'runtime'),
  s('REP-RUNTIME-002', 'recover-stale-heartbeat', 'LOW', 'policy-controlled', 'heartbeat-fresh', 'runtime'),
  s('REP-RUNTIME-003', 'clear-safe-temporary-runtime-state', 'SAFE', true, 'temp-runtime-cleared', 'runtime'),
  s('REP-RUNTIME-004', 'rebuild-generated-non-business-runtime-metadata', 'SAFE', true, 'runtime-metadata-rebuildable', 'runtime'),
  s('REP-RUNTIME-005', 'rotate-oversized-logs', 'SAFE', true, 'log-rotation-ok', 'runtime'),

  // API
  s('REP-API-001', 'reconnect-internal-dependency', 'SAFE', true, 'dependency-reachable', 'api'),
  s('REP-API-002', 'refresh-service-registration', 'SAFE', true, 'registration-fresh', 'api'),
  s('REP-API-003', 'invalidate-stale-api-metadata-cache', 'SAFE', true, 'api-cache-empty', 'api'),
  s('REP-API-004', 'recover-safe-connection-pool-anomaly', 'LOW', 'policy-controlled', 'pool-healthy', 'api'),

  // PostgreSQL / Prisma
  s('REP-DB-001', 'refresh-reconnect-db-pool', 'SAFE', true, 'db-select-1-ok', 'database'),
  s('REP-DB-002', 'recover-safe-stale-connection-state', 'LOW', 'policy-controlled', 'db-pool-healthy', 'database'),
  s('REP-DB-003', 'validate-propose-migration', 'HIGH', false, 'migration-state-and-health', 'database', { backup: 'REQUIRED' }),
  s('REP-DB-004', 'rebuild-approved-non-critical-index', 'MEDIUM', false, 'index-usable', 'database', { backup: 'recommended' }),
  s('REP-DB-005', 'clear-technical-metadata-cache', 'SAFE', true, 'metadata-cache-cleared', 'database'),
  s('REP-DB-006', 'repair-known-technical-metadata-inconsistency', 'MEDIUM', false, 'metadata-consistent', 'database'),
  s('REP-DB-007', 'diagnose-lock-contention', 'SAFE', true, 'lock-report-available', 'database'),
  s('REP-DB-008', 'propose-schema-migration-with-explicit-approval', 'HIGH', false, 'migration-state-and-health', 'database', { backup: 'REQUIRED' }),

  // Redis
  s('REP-REDIS-001', 'targeted-cache-namespace-invalidation', 'SAFE', true, 'cache-namespace-empty-and-rebuildable', 'redis'),
  s('REP-REDIS-002', 'rebuild-application-cache', 'SAFE', true, 'cache-rebuildable', 'redis'),
  s('REP-REDIS-003', 'reconnect-redis-client', 'SAFE', true, 'redis-ping-ok', 'redis'),
  s('REP-REDIS-004', 'recover-safe-consumer-connection-state', 'LOW', 'policy-controlled', 'consumer-connected', 'redis'),
  s('REP-REDIS-005', 'diagnose-memory-pressure', 'SAFE', true, 'memory-report-available', 'redis'),
  s(
    'REP-REDIS-FLUSHALL-BLOCKED',
    'global-redis-flushall',
    'BLOCKED',
    false,
    'n/a-blocked',
    'redis',
    {
      blockedReason: 'GLOBAL FLUSHALL is permanently BLOCKED',
      description: 'Marker — never execute Redis FLUSHALL',
    },
  ),

  // BullMQ workers / queues
  s('REP-WORKER-001', 'restart-unhealthy-worker', 'LOW', 'policy-controlled', 'worker-heartbeat-restored', 'worker'),
  s('REP-WORKER-002', 'recover-stalled-heartbeat', 'LOW', 'policy-controlled', 'heartbeat-restored', 'worker'),
  s('REP-WORKER-003', 'reconcile-worker-registration', 'SAFE', true, 'worker-registry-consistent', 'worker'),
  s('REP-QUEUE-001', 'inspect-stalled-job', 'SAFE', true, 'stalled-job-report', 'queue'),
  s('REP-QUEUE-002', 'recover-stalled-job-after-idempotency-check', 'MEDIUM', false, 'job-progress-and-side-effect-check', 'queue'),
  s('REP-QUEUE-003', 'quarantine-permanently-failed-technical-job', 'LOW', 'policy-controlled', 'job-quarantined', 'queue'),
  s('REP-QUEUE-004', 'rebuild-queue-metrics', 'SAFE', true, 'queue-metrics-fresh', 'queue'),
  s('REP-QUEUE-005', 'replay-approved-idempotent-job', 'MEDIUM', false, 'job-replay-side-effect-check', 'queue'),
  s(
    'REP-QUEUE-BLIND-REPLAY-BLOCKED',
    'blind-business-job-replay',
    'BLOCKED',
    false,
    'n/a-blocked',
    'queue',
    {
      blockedReason: 'Blind business replay is permanently BLOCKED',
      description: 'Marker — never blind-replay business jobs',
    },
  ),

  // Modules
  s('REP-MODULE-001', 'refresh-registry', 'SAFE', true, 'registry-fresh', 'module'),
  s('REP-MODULE-002', 'validate-manifest', 'SAFE', true, 'manifest-valid', 'module'),
  s('REP-MODULE-003', 'repair-stale-capability-cache', 'SAFE', true, 'capability-cache-fresh', 'module'),
  s('REP-MODULE-004', 'reconcile-dependency-metadata', 'LOW', 'policy-controlled', 'deps-metadata-consistent', 'module'),
  s('REP-MODULE-005', 'propose-module-migration', 'HIGH', false, 'module-migration-plan', 'module', { backup: 'REQUIRED' }),
  s('REP-MODULE-006', 'safe-module-reload-where-supported', 'MEDIUM', false, 'module-health-ok', 'module'),

  // Configuration
  s('REP-CONFIG-001', 'reload-safe-configuration', 'SAFE', true, 'config-reloaded', 'config'),
  s('REP-CONFIG-002', 'restore-invalid-value-from-validated-default', 'MEDIUM', false, 'config-value-valid', 'config', { backup: 'recommended' }),
  s('REP-CONFIG-003', 'reconcile-configuration-schema', 'LOW', 'policy-controlled', 'config-schema-ok', 'config'),
  s('REP-CONFIG-004', 'invalidate-configuration-cache', 'SAFE', true, 'config-cache-cleared', 'config'),
  s('REP-CONFIG-005', 'propose-impactful-correction', 'HIGH', false, 'config-impact-reviewed', 'config', { backup: 'REQUIRED' }),

  // Filesystem / storage
  s('REP-FS-001', 'delete-expired-temp-files', 'SAFE', true, 'temp-files-purged', 'filesystem'),
  s('REP-FS-002', 'rotate-logs', 'SAFE', true, 'log-rotation-ok', 'filesystem'),
  s('REP-FS-003', 'rebuild-safe-storage-manifest-index', 'SAFE', true, 'storage-index-ok', 'filesystem'),
  s('REP-FS-004', 'restore-missing-generated-artifact', 'LOW', 'policy-controlled', 'artifact-present', 'filesystem'),
  s('REP-FS-005', 'repair-safe-managed-path-permissions', 'MEDIUM', false, 'permissions-ok', 'filesystem'),
  s('REP-FS-006', 'diagnose-disk-pressure', 'SAFE', true, 'disk-report-available', 'filesystem'),

  // Documents / search
  s('REP-DOC-001', 'rebuild-non-business-document-index', 'SAFE', true, 'doc-index-ok', 'documents'),
  s('REP-DOC-002', 'regenerate-safe-derived-metadata', 'SAFE', true, 'derived-metadata-ok', 'documents'),
  s('REP-DOC-003', 'repair-idempotent-document-processing-state', 'LOW', 'policy-controlled', 'doc-processing-ok', 'documents'),
  s('REP-DOC-004', 'quarantine-corrupt-derived-artifact', 'LOW', 'policy-controlled', 'artifact-quarantined', 'documents'),
  s('REP-SEARCH-001', 'rebuild-non-critical-search-index', 'SAFE', true, 'search-index-ok', 'search'),
  s('REP-SEARCH-002', 'invalidate-stale-search-cache', 'SAFE', true, 'search-cache-cleared', 'search'),
  s('REP-SEARCH-003', 'reconcile-search-metadata', 'LOW', 'policy-controlled', 'search-metadata-ok', 'search'),

  // Notifications / scheduler
  s('REP-NOTIF-001', 'restart-notification-worker', 'LOW', 'policy-controlled', 'notif-worker-heartbeat', 'notifications'),
  s('REP-NOTIF-002', 'reconnect-provider-adapter', 'SAFE', true, 'provider-reachable', 'notifications'),
  s('REP-NOTIF-003', 'rebuild-notification-queue-metrics', 'SAFE', true, 'notif-metrics-fresh', 'notifications'),
  s('REP-NOTIF-004', 'quarantine-repeatedly-failing-technical-notification', 'LOW', 'policy-controlled', 'notif-quarantined', 'notifications'),
  s('REP-SCHED-001', 'reconcile-scheduler-registration', 'SAFE', true, 'scheduler-registry-ok', 'scheduler'),
  s('REP-SCHED-002', 'recover-stalled-scheduler-worker', 'LOW', 'policy-controlled', 'scheduler-heartbeat', 'scheduler'),
  s('REP-SCHED-003', 'rebuild-scheduler-metadata', 'SAFE', true, 'scheduler-metadata-ok', 'scheduler'),

  // Offline / sync
  s('REP-SYNC-001', 'reconcile-safe-cursor-metadata', 'SAFE', true, 'cursor-metadata-ok', 'sync'),
  s('REP-SYNC-002', 'retry-idempotent-synchronization', 'LOW', 'policy-controlled', 'sync-progress-ok', 'sync'),
  s('REP-SYNC-003', 'quarantine-malformed-sync-item', 'LOW', 'policy-controlled', 'sync-item-quarantined', 'sync'),
  s('REP-SYNC-004', 'rebuild-local-sync-diagnostics', 'SAFE', true, 'sync-diagnostics-ok', 'sync'),
  s(
    'REP-SYNC-BLIND-CONFLICT-BLOCKED',
    'blind-conflict-resolution',
    'BLOCKED',
    false,
    'n/a-blocked',
    'sync',
    {
      blockedReason: 'Blind conflict resolution is permanently BLOCKED',
    },
  ),

  // Tenant
  s('REP-TENANT-001', 'refresh-tenant-context-cache', 'SAFE', true, 'tenant-cache-fresh', 'tenant'),
  s('REP-TENANT-002', 'reconcile-safe-site-metadata', 'LOW', 'policy-controlled', 'site-metadata-ok', 'tenant'),
  s('REP-TENANT-003', 'validate-tenant-isolation', 'SAFE', true, 'isolation-report-ok', 'tenant'),
  s(
    'REP-TENANT-CROSS-MUTATION-BLOCKED',
    'cross-tenant-mutation',
    'BLOCKED',
    false,
    'n/a-blocked',
    'tenant',
    {
      blockedReason: 'Cross-tenant mutation is permanently BLOCKED',
    },
  ),

  // Performance
  s('REP-PERF-001', 'targeted-cache-clear', 'SAFE', true, 'cache-cleared', 'performance'),
  s('REP-PERF-002', 'safe-cache-rebuild', 'SAFE', true, 'cache-rebuildable', 'performance'),
  s('REP-PERF-003', 'log-rotation', 'SAFE', true, 'log-rotation-ok', 'performance'),
  s('REP-PERF-004', 'safe-metrics-refresh', 'SAFE', true, 'metrics-fresh', 'performance'),
  s('REP-PERF-005', 'propose-index-optimization', 'MEDIUM', false, 'index-proposal-reviewed', 'performance'),

  // Backup / snapshot
  s('REP-BACKUP-001', 'retry-failed-backup', 'LOW', true, 'backup-artifact-present', 'backup'),
  s('REP-BACKUP-002', 'validate-backup-artifact', 'LOW', true, 'checksum-and-readability', 'backup'),
  s('REP-BACKUP-003', 'reconcile-backup-metadata', 'SAFE', true, 'backup-metadata-ok', 'backup'),
  s('REP-SNAPSHOT-001', 'validate-snapshot-metadata', 'SAFE', true, 'snapshot-metadata-ok', 'snapshot'),
  s('REP-SNAPSHOT-002', 'create-approved-snapshot', 'LOW', 'policy-controlled', 'snapshot-ref-created', 'snapshot'),

  // Security
  s('REP-SEC-001', 'refresh-permission-cache', 'SAFE', true, 'permission-cache-fresh', 'security'),
  s('REP-SEC-002', 'invalidate-stale-session-metadata', 'LOW', 'policy-controlled', 'session-metadata-cleared', 'security'),
  s('REP-SEC-003', 'reconcile-managed-permission-cache', 'MEDIUM', false, 'permission-cache-consistent', 'security'),
  s(
    'REP-SEC-POLICY-HIGH',
    'security-policy-changes',
    'HIGH',
    false,
    'policy-diff-approved',
    'security',
    {
      description: 'Security policy changes require explicit approval',
      backup: 'REQUIRED',
    },
  ),

  // Business — no generic repairs; markers only
  s(
    'REP-BUSINESS-MUTATION-BLOCKED',
    'generic-business-data-mutation',
    'BLOCKED',
    false,
    'n/a-blocked',
    'business',
    {
      blockedReason:
        'No generic business-data repair — invoice/payment/stock mutations BLOCKED',
      description: 'Marker — never mutate invoice, payment, or stock via Repair',
    },
  ),
  s(
    'REP-SQL-ARBITRARY-BLOCKED',
    'arbitrary-sql-execution',
    'BLOCKED',
    false,
    'n/a-blocked',
    'database',
    {
      blockedReason: 'Arbitrary SQL is permanently BLOCKED',
    },
  ),

  // Recovery / code plane — permanently BLOCKED (D085)
  s(
    'REP-CODE-GITHUB-REINSTALL-BLOCKED',
    'github-live-code-reinstall',
    'BLOCKED',
    false,
    'n/a-blocked',
    'recovery',
    {
      blockedReason:
        'Live GitHub fetch + source reinstall is permanently BLOCKED (supply-chain / drift)',
      description:
        'Recovery must use signed release artifacts + SOC backup — never git pull into runtime',
    },
  ),
  s(
    'REP-SOURCE-REWRITE-BLOCKED',
    'runtime-source-rewrite',
    'BLOCKED',
    false,
    'n/a-blocked',
    'recovery',
    {
      blockedReason: 'Rewriting application source from Repair is permanently BLOCKED',
    },
  ),
  s(
    'REP-MODULE-BINARY-REPLACE-BLOCKED',
    'hot-swap-module-binaries',
    'BLOCKED',
    false,
    'n/a-blocked',
    'recovery',
    {
      blockedReason:
        'Hot-swapping module binaries without signed artifact + human Recovery wizard is BLOCKED',
    },
  ),
  s(
    'REP-OS-PROCESS-KILL-BLOCKED',
    'os-process-kill-restart',
    'BLOCKED',
    false,
    'n/a-blocked',
    'runtime',
    {
      blockedReason:
        'OS-level process kill/restart from Repair is BLOCKED (watchdog heartbeat only)',
    },
  ),
] as const;

export const REPAIR_SCENARIOS_BY_ID: ReadonlyMap<string, RepairScenario> =
  new Map(REPAIR_SCENARIOS.map((sc) => [sc.id, sc]));

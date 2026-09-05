/**
 * Thunder monitor snapshot — schema for ResourceMonitor widget (THU-07).
 * Documented in AUTHORITY-DOCUMENTATION `03_THUNDER_CORE/OBSERVABILITY.md`.
 */
export interface ThunderMonitorSnapshot {
  schemaVersion: 1;
  asOf: string;
  cpu: {
    usageRatio: number | null;
    loadAvg1: number | null;
    cores: number;
  };
  ram: {
    usedBytes: number;
    totalBytes: number;
    usageRatio: number;
    processRssBytes: number;
  };
  workers: {
    enabled: boolean;
    queues: Array<{
      family: string;
      concurrency: number;
    }>;
  };
  queues: Array<{
    family: string;
    pending: number;
    running: number;
    failed: number;
    pausedByModule: number;
  }>;
  jobs: {
    pending: number;
    running: number;
    failed: number;
    completed: number;
    cancelled: number;
    pausedByModule: number;
    dlq: number;
  };
  events: {
    /** Unpublished outbox row count. */
    outboxLag: number;
    /** Age of unpublished rows in seconds (THU-HARD-01). */
    outboxLagSeconds: {
      oldest: number | null;
      p50: number | null;
      p95: number | null;
      p99: number | null;
    };
    /** Exhausted outbox publishes (THU-HARD-05). */
    outboxDlq: number;
    publishedLastMinute: number;
    eventsPerSecondEstimate: number;
  };
  /** Circuit breakers (THU-HARD-02). stateGauge: 0=closed 1=open 2=half_open */
  breakers: Array<{
    dependencyKey: string;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    stateGauge: 0 | 1 | 2;
    failures: number;
    openedAt: string | null;
  }>;
  /** Admission rejects since process start (THU-HARD-03). */
  admission: {
    rejectTotal: number;
    rejectByReason: Record<string, number>;
  };
  /** Prometheus scrape metadata + counter totals (THU-HARD-04). */
  metrics: {
    scrapePath: string;
    contentType: string;
    jobSuccessTotal: number;
    jobFailTotal: number;
    jobRetryTotal: number;
    admissionRejectTotal: number;
  };
  /** OpenTelemetry hooks status (THU-HARD-06). */
  tracing: {
    enabled: boolean;
    tracerName: string;
  };
  db: {
    ok: boolean;
    poolUsageRatio: number | null;
  };
  redis: {
    configured: boolean;
    ok: boolean;
    usedMemoryBytes: number | null;
  };
  api: {
    p95Ms: number | null;
  };
  pressure: {
    shedP4: boolean;
    reason?: string;
  };
  systemMode: string;
}

/**
 * Full Thunder monitor snapshot — mirrors API ThunderMonitorSnapshot schemaVersion 1.
 * Secrets never appear here.
 */

export type ThunderMonitorSnapshot = {
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
    queues: Array<{ family: string; concurrency: number }>;
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
    outboxLag: number;
    outboxLagSeconds: {
      oldest: number | null;
      p50: number | null;
      p95: number | null;
      p99: number | null;
    };
    outboxDlq: number;
    publishedLastMinute: number;
    eventsPerSecondEstimate: number;
    processedEventRows: number;
  };
  breakers: Array<{
    dependencyKey: string;
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    stateGauge: 0 | 1 | 2;
    failures: number;
    openedAt: string | null;
  }>;
  admission: {
    rejectTotal: number;
    rejectByReason: Record<string, number>;
  };
  metrics: {
    scrapePath: string;
    contentType: string;
    jobSuccessTotal: number;
    jobFailTotal: number;
    jobRetryTotal: number;
    admissionRejectTotal: number;
  };
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
};

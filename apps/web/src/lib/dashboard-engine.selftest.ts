/**
 * Dashboard / Thunder widget registry selftest.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/dashboard-engine.selftest.ts
 */
import { WidgetRegistry } from "./dashboard-engine/registry";
import {
  ensureThunderWidgetsRegistered,
  THUNDER_COMMAND_CENTER,
  THUNDER_WIDGET_DEFINITIONS,
} from "./thunder/command-center-catalog";
import { evaluateThunderAlerts } from "./thunder/alert-thresholds";
import { deriveThunderHealth, overallHealth } from "./thunder/health-derive";
import type { ThunderMonitorSnapshot } from "./thunder/monitor-types";

const reg = new WidgetRegistry();
reg.registerMany(THUNDER_WIDGET_DEFINITIONS);

if (reg.list("thunder").length !== THUNDER_WIDGET_DEFINITIONS.length) {
  throw new Error("thunder widget count mismatch");
}

if (!reg.validate("thunder.health", new Set(["system_monitoring.view"]))) {
  throw new Error("health widget should pass monitoring grant");
}

if (reg.validate("thunder.health", new Set(["other"]))) {
  throw new Error("health widget must fail without grant");
}

ensureThunderWidgetsRegistered();
if (THUNDER_COMMAND_CENTER.widgets.length < 10) {
  throw new Error("command center layout too small");
}

const snap: ThunderMonitorSnapshot = {
  schemaVersion: 1,
  asOf: new Date().toISOString(),
  cpu: { usageRatio: 0.2, loadAvg1: 0.5, cores: 4 },
  ram: {
    usedBytes: 1,
    totalBytes: 2,
    usageRatio: 0.4,
    processRssBytes: 1,
  },
  workers: { enabled: true, queues: [{ family: "default", concurrency: 2 }] },
  queues: [
    { family: "default", pending: 1, running: 0, failed: 0, pausedByModule: 0 },
  ],
  jobs: {
    pending: 1,
    running: 0,
    failed: 0,
    completed: 10,
    cancelled: 0,
    pausedByModule: 0,
    dlq: 0,
  },
  events: {
    outboxLag: 0,
    outboxLagSeconds: { oldest: null, p50: null, p95: null, p99: null },
    outboxDlq: 0,
    publishedLastMinute: 3,
    eventsPerSecondEstimate: 0.1,
    processedEventRows: 100,
  },
  breakers: [],
  admission: { rejectTotal: 0, rejectByReason: {} },
  metrics: {
    scrapePath: "/api/v1/thunder/metrics",
    contentType: "text/plain",
    jobSuccessTotal: 1,
    jobFailTotal: 0,
    jobRetryTotal: 0,
    admissionRejectTotal: 0,
  },
  tracing: { enabled: false, tracerName: "authority" },
  db: { ok: true, poolUsageRatio: 0.1 },
  redis: { configured: true, ok: true, usedMemoryBytes: 1024 },
  api: { p95Ms: 40 },
  pressure: { shedP4: false },
  systemMode: "NORMAL",
};

const health = deriveThunderHealth(snap);
if (overallHealth(health) !== "HEALTHY") {
  throw new Error("expected HEALTHY overall");
}

const alerts = evaluateThunderAlerts({
  cpuRatio: 0.95,
  ramRatio: 0.5,
  queuePending: 0,
  jobFailed: 0,
  apiP95Ms: 10,
  outboxDlq: 0,
});
if (!alerts.some((a) => a.code === "CPU_CRITICAL")) {
  throw new Error("expected CPU_CRITICAL alert");
}

console.log(
  `dashboard-engine.selftest OK widgets=${THUNDER_WIDGET_DEFINITIONS.length} layout=${THUNDER_COMMAND_CENTER.widgets.length}`,
);

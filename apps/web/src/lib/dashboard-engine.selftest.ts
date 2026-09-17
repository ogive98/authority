/**
 * Dashboard / Thunder widget registry selftest.
 * Run: npx tsx --tsconfig tsconfig.json src/lib/dashboard-engine.selftest.ts
 */
import { WidgetRegistry } from "./dashboard-engine/registry";
import {
  clampPosition,
  densifyWidgetLayout,
  nextFreeRow,
  rectsOverlap,
  resolveWidgetOverlaps,
  thunderGridItemStyle,
  thunderLayoutSortKey,
} from "./dashboard-engine/layout";
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

const clamped = clampPosition({ x: 20, y: -1, w: 4, h: 2 }, 12);
if (clamped.x !== 8 || clamped.y !== 0 || clamped.w !== 4) {
  throw new Error(`clampPosition failed: ${JSON.stringify(clamped)}`);
}
const vars = thunderGridItemStyle({ x: 4, y: 2, w: 6, h: 2 }, false);
if (vars["--tc-gc"] !== "5 / span 6" || vars["--tc-gr"] !== "3 / span 2") {
  throw new Error(`thunderGridItemStyle failed: ${JSON.stringify(vars)}`);
}
if (!vars.minHeight || !vars.minHeight.endsWith("rem")) {
  throw new Error(`expected minHeight rem, got ${vars.minHeight}`);
}
const yNext = nextFreeRow(THUNDER_COMMAND_CENTER.widgets);
if (yNext < 2) {
  throw new Error(`nextFreeRow too small: ${yNext}`);
}
const sorted = [...THUNDER_COMMAND_CENTER.widgets].sort(
  (a, b) => thunderLayoutSortKey(a) - thunderLayoutSortKey(b),
);
if (sorted[0]?.position.y > sorted[sorted.length - 1]?.position.y) {
  throw new Error("thunderLayoutSortKey order broken");
}

const overlapA = { id: "a", order: 0, position: { x: 0, y: 0, w: 4, h: 2 } };
const overlapB = { id: "b", order: 1, position: { x: 2, y: 0, w: 4, h: 2 } };
const packed = resolveWidgetOverlaps([overlapA, overlapB]);
const pa = packed.find((w) => w.id === "a")!;
const pb = packed.find((w) => w.id === "b")!;
if (rectsOverlap(pa.position, pb.position)) {
  throw new Error("resolveWidgetOverlaps left overlapping widgets");
}
if (pb.position.y < 2) {
  throw new Error(`expected B pushed below A, got y=${pb.position.y}`);
}

const sparse = [
  { id: "s1", order: 0, position: { x: 8, y: 4, w: 4, h: 2 } },
  { id: "s2", order: 1, position: { x: 0, y: 0, w: 4, h: 2 } },
];
const dense = densifyWidgetLayout(sparse);
const d1 = dense.find((w) => w.id === "s2")!;
const d2 = dense.find((w) => w.id === "s1")!;
if (d1.position.x !== 0 || d1.position.y !== 0) {
  throw new Error(`densify first slot failed: ${JSON.stringify(d1.position)}`);
}
if (d2.position.y !== 0 || d2.position.x !== 4) {
  throw new Error(`densify pack failed: ${JSON.stringify(d2.position)}`);
}
if (rectsOverlap(d1.position, d2.position)) {
  throw new Error("densify left overlapping widgets");
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

const snapWorkersOff = {
  ...snap,
  workers: { ...snap.workers, enabled: false },
  jobs: { ...snap.jobs, dlq: 2 },
};
const degraded = deriveThunderHealth(snapWorkersOff);
const workersItem = degraded.find((i) => i.id === "workers");
if (workersItem?.state !== "DEGRADED") {
  throw new Error(`expected workers DEGRADED, got ${workersItem?.state}`);
}
if (overallHealth(degraded) !== "CRITICAL") {
  throw new Error(
    `expected CRITICAL overall (DLQ dominates workers-off), got ${overallHealth(degraded)}`,
  );
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

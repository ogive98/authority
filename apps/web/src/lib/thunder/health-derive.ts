import type { HealthItem, HealthState } from "@/lib/dashboard-engine";
import type { ThunderMonitorSnapshot } from "./monitor-types";

function ratioState(
  ratio: number | null | undefined,
  warnAt: number,
  critAt: number,
): HealthState {
  if (ratio == null || Number.isNaN(ratio)) return "UNKNOWN";
  if (ratio >= critAt) return "CRITICAL";
  if (ratio >= warnAt) return "WARNING";
  return "HEALTHY";
}

/**
 * Derive Thunder Health matrix from monitor snapshot.
 * Thresholds are parameters — never hardcoded call-sites (prefs later).
 */
export function deriveThunderHealth(
  snap: ThunderMonitorSnapshot | null | undefined,
  thresholds = { cpuWarn: 0.75, cpuCrit: 0.9, ramWarn: 0.8, ramCrit: 0.92 },
): HealthItem[] {
  if (!snap) {
    return [
      {
        id: "core",
        label: "Core",
        state: "UNKNOWN",
        detail: "Snapshot indisponible",
      },
    ];
  }

  const cpu = ratioState(
    snap.cpu.usageRatio,
    thresholds.cpuWarn,
    thresholds.cpuCrit,
  );
  const ram = ratioState(
    snap.ram.usageRatio,
    thresholds.ramWarn,
    thresholds.ramCrit,
  );

  const openBreakers = snap.breakers.filter((b) => b.state !== "CLOSED").length;
  const eventBus: HealthState =
    snap.events.outboxDlq > 0
      ? "CRITICAL"
      : snap.events.outboxLag > 50
        ? "WARNING"
        : "HEALTHY";

  const workers: HealthState = !snap.workers.enabled
    ? "DEGRADED"
    : snap.jobs.failed > 20
      ? "WARNING"
      : "HEALTHY";

  const queues: HealthState =
    snap.jobs.dlq > 0
      ? "CRITICAL"
      : snap.jobs.pending > 100
        ? "WARNING"
        : "HEALTHY";

  const armed = snap.workers.queues.filter((q) => q.concurrency > 0).length;
  const scheduler: HealthState = !snap.workers.enabled
    ? "DEGRADED"
    : armed === 0
      ? "WARNING"
      : "HEALTHY";

  return [
    {
      id: "core",
      label: "Core",
      state: snap.pressure.shedP4 ? "DEGRADED" : "HEALTHY",
      detail: snap.systemMode,
    },
    {
      id: "api",
      label: "API",
      state:
        snap.api.p95Ms != null && snap.api.p95Ms > 2000
          ? "WARNING"
          : "HEALTHY",
      detail:
        snap.api.p95Ms != null ? `p95 ${Math.round(snap.api.p95Ms)}ms` : "n/a",
    },
    {
      id: "postgres",
      label: "PostgreSQL",
      state: snap.db.ok ? "HEALTHY" : "CRITICAL",
      detail:
        snap.db.poolUsageRatio != null
          ? `pool ${Math.round(snap.db.poolUsageRatio * 100)}%`
          : undefined,
    },
    {
      id: "redis",
      label: "Redis",
      state: !snap.redis.configured
        ? "UNKNOWN"
        : snap.redis.ok
          ? "HEALTHY"
          : "CRITICAL",
      detail: snap.redis.configured ? undefined : "non configuré",
    },
    {
      id: "event-bus",
      label: "Event Bus",
      state: eventBus,
      detail: `outbox lag ${snap.events.outboxLag}`,
    },
    {
      id: "workers",
      label: "Workers",
      state: workers,
      detail: snap.workers.enabled
        ? `${snap.workers.queues.length} queues`
        : "disabled (config)",
    },
    {
      id: "queues",
      label: "Queues",
      state: queues,
      detail: `${snap.jobs.pending} pending · ${snap.jobs.dlq} DLQ`,
    },
    {
      id: "scheduler",
      label: "Scheduler",
      state: scheduler,
      detail: snap.workers.enabled
        ? `${armed} familles armées`
        : `DISABLED · ${armed} configurées`,
    },
    {
      id: "outbox",
      label: "Outbox",
      state:
        snap.events.outboxDlq > 0
          ? "CRITICAL"
          : snap.events.outboxLag > 20
            ? "WARNING"
            : "HEALTHY",
      detail:
        snap.events.outboxLagSeconds.oldest != null
          ? `oldest ${Math.round(snap.events.outboxLagSeconds.oldest)}s`
          : `lag ${snap.events.outboxLag}`,
    },
    {
      id: "breakers",
      label: "Breakers",
      state: openBreakers > 0 ? "WARNING" : "HEALTHY",
      detail: openBreakers > 0 ? `${openBreakers} open` : "all closed",
    },
    {
      id: "cpu",
      label: "CPU",
      state: cpu,
      detail:
        snap.cpu.usageRatio != null
          ? `${Math.round(snap.cpu.usageRatio * 100)}%`
          : "n/a",
    },
    {
      id: "ram",
      label: "RAM",
      state: ram,
      detail: `${Math.round(snap.ram.usageRatio * 100)}%`,
    },
  ];
}

export function overallHealth(items: HealthItem[]): HealthState {
  // OFFLINE < CRITICAL for rollup: intentional worker-off should not mask DLQ/CRITICAL.
  const rank: Record<HealthState, number> = {
    HEALTHY: 0,
    UNKNOWN: 1,
    DEGRADED: 2,
    WARNING: 3,
    OFFLINE: 4,
    CRITICAL: 5,
  };
  const known = items.filter((i) => i.state !== "UNKNOWN");
  const pool = known.length > 0 ? known : items;
  let worst: HealthState = "HEALTHY";
  for (const i of pool) {
    if (rank[i.state] > rank[worst]) worst = i.state;
  }
  return worst;
}

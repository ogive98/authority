"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { healthTone, type WidgetLoadState } from "@/lib/dashboard-engine";
import {
  evaluateThunderAlerts,
  type ThunderAlertThresholds,
} from "@/lib/thunder/alert-thresholds";
import {
  deriveThunderHealth,
  overallHealth,
} from "@/lib/thunder/health-derive";
import type { ThunderMonitorSnapshot } from "@/lib/thunder/monitor-types";
import { cn } from "@/lib/utils";
import { MetricRow, MiniGauge, WidgetShell } from "./widget-shell";

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function monitorState(
  q: { isPending: boolean; isError: boolean; isFetching: boolean; dataUpdatedAt: number },
  liveMode: boolean,
): WidgetLoadState {
  if (q.isPending) return "loading";
  if (q.isError) return "unavailable";
  if (!liveMode && Date.now() - q.dataUpdatedAt > 60_000) return "stale";
  return "loaded";
}

export function ThunderHealthWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
  thresholds,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
  thresholds: ThunderAlertThresholds;
}) {
  const items = deriveThunderHealth(snap, {
    cpuWarn: thresholds.cpuWarn,
    cpuCrit: thresholds.cpuCrit,
    ramWarn: thresholds.ramWarn,
    ramCrit: thresholds.ramCrit,
  });
  const overall = overallHealth(items);
  const tone = healthTone(overall);

  return (
    <WidgetShell
      title="Thunder Health"
      subtitle={`${tone.label} · ${items.length} checks`}
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {items.map((item) => {
          const t = healthTone(item.state);
          return (
            <li
              key={item.id}
              className="rounded-[var(--a-radius-sm)] bg-a-surface-3/60 px-2 py-1.5"
              title={item.detail ?? item.state}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", t.dotClass)}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-medium text-a-fg">
                  {item.label}
                </span>
              </div>
              <p className={cn("mt-0.5 text-[10px]", t.className)}>
                {t.label}
                {item.detail ? (
                  <span className="text-a-fg-subtle"> · {item.detail}</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

export function CoreRuntimeWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  return (
    <WidgetShell
      title="Core Runtime"
      subtitle={snap?.systemMode}
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <div className="flex flex-wrap items-center justify-around gap-3">
        <MiniGauge label="CPU" ratio={snap?.cpu.usageRatio ?? null} />
        <MiniGauge label="RAM" ratio={snap?.ram.usageRatio ?? null} />
        <MiniGauge label="Pool" ratio={snap?.db.poolUsageRatio ?? null} />
      </div>
      <div className="mt-3 space-y-0.5 border-t border-[color:var(--a-border-subtle)] pt-2">
        <MetricRow
          label="Cores"
          value={snap ? String(snap.cpu.cores) : "—"}
        />
        <MetricRow
          label="Load 1m"
          value={
            snap?.cpu.loadAvg1 != null ? snap.cpu.loadAvg1.toFixed(2) : "—"
          }
        />
        <MetricRow
          label="Pressure"
          value={snap?.pressure.shedP4 ? "P4 shed" : "ok"}
        />
      </div>
    </WidgetShell>
  );
}

export function IncidentsWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const openBreakers =
    snap?.breakers.filter((b) => b.state !== "CLOSED").length ?? 0;
  const critical =
    (snap?.jobs.dlq ?? 0) +
    (snap?.events.outboxDlq ?? 0) +
    (snap && !snap.db.ok ? 1 : 0);
  const errors = (snap?.jobs.failed ?? 0) + openBreakers;
  const warnings = snap?.pressure.shedP4 ? 1 : 0;

  return (
    <WidgetShell
      title="Active Incidents"
      subtitle="Dérivé snapshot · pas d’inventaire inventé"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
      actions={
        <Link
          href="/repair"
          className="text-[10px] font-medium text-a-accent hover:underline"
        >
          Repair
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Critical", critical, "text-a-danger-fg"],
          ["Error", errors, "text-a-danger-fg"],
          ["Warning", warnings, "text-a-warning-fg"],
          ["Breakers", openBreakers, "text-a-fg"],
        ].map(([label, n, cls]) => (
          <div
            key={String(label)}
            className="rounded-[var(--a-radius-sm)] bg-a-surface-3/60 px-2.5 py-2"
          >
            <p className="text-[10px] uppercase tracking-wider text-a-fg-subtle">
              {label}
            </p>
            <p className={cn("a-mono mt-1 text-xl font-semibold", cls)}>
              {n}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 border-t border-[color:var(--a-border-subtle)] pt-2">
        <MetricRow label="Job DLQ" value={String(snap?.jobs.dlq ?? 0)} />
        <MetricRow
          label="Outbox DLQ"
          value={String(snap?.events.outboxDlq ?? 0)}
        />
        {(snap?.breakers.filter((b) => b.state !== "CLOSED") ?? []).map((b) => (
          <p
            key={b.dependencyKey}
            className="a-mono text-[10px] text-a-warning-fg"
            title={b.openedAt ?? undefined}
          >
            {b.dependencyKey} · {b.state} · fail {b.failures}
          </p>
        ))}
        {openBreakers === 0 ? (
          <p className="text-[10px] text-a-fg-subtle">Tous les breakers CLOSED</p>
        ) : null}
      </div>
    </WidgetShell>
  );
}

export function EventBusWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const e = snap?.events;
  return (
    <WidgetShell
      title="Event Bus"
      subtitle="Outbox + processed"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow label="Outbox lag" value={String(e?.outboxLag ?? "—")} />
      <MetricRow label="Outbox DLQ" value={String(e?.outboxDlq ?? "—")} />
      <MetricRow
        label="Published / min"
        value={String(e?.publishedLastMinute ?? "—")}
      />
      <MetricRow
        label="Events / s"
        value={
          e?.eventsPerSecondEstimate != null
            ? e.eventsPerSecondEstimate.toFixed(2)
            : "—"
        }
      />
      <MetricRow
        label="Processed rows"
        value={String(e?.processedEventRows ?? "—")}
      />
      <MetricRow
        label="Lag p95"
        value={
          e?.outboxLagSeconds.p95 != null
            ? `${Math.round(e.outboxLagSeconds.p95)}s`
            : "—"
        }
      />
    </WidgetShell>
  );
}

export function WorkersWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const rows = snap?.workers.queues ?? [];
  return (
    <WidgetShell
      title="Workers"
      subtitle={
        snap?.workers.enabled ? "RUNNING" : "DISABLED"
      }
      state={rows.length === 0 && loadState === "loaded" ? "empty" : loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <ul className="space-y-1">
        {rows.map((w) => (
          <li
            key={w.family}
            className="flex items-center justify-between gap-2 rounded-[var(--a-radius-sm)] px-1 py-1 text-[12px]"
          >
            <span className="truncate font-medium text-a-fg">{w.family}</span>
            <span className="a-mono text-a-fg-muted">
              c={w.concurrency}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-[color:var(--a-border-subtle)] pt-2">
        <MetricRow
          label="Jobs running"
          value={String(snap?.jobs.running ?? "—")}
        />
        <MetricRow
          label="Completed"
          value={String(snap?.jobs.completed ?? "—")}
        />
        <MetricRow label="Failed" value={String(snap?.jobs.failed ?? "—")} />
      </div>
    </WidgetShell>
  );
}

export function QueuesWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const rows = snap?.queues ?? [];
  return (
    <WidgetShell
      title="Queues"
      subtitle={`${snap?.jobs.pending ?? 0} pending · DLQ ${snap?.jobs.dlq ?? 0}`}
      state={rows.length === 0 && loadState === "loaded" ? "empty" : loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="text-a-fg-subtle">
            <tr>
              <th className="pb-1 font-medium">Queue</th>
              <th className="pb-1 font-medium">Wait</th>
              <th className="pb-1 font-medium">Run</th>
              <th className="pb-1 font-medium">Fail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.family} className="border-t border-[color:var(--a-border-subtle)]">
                <td className="py-1 font-medium text-a-fg">{q.family}</td>
                <td className="a-mono py-1 text-a-fg-muted">{q.pending}</td>
                <td className="a-mono py-1 text-a-fg-muted">{q.running}</td>
                <td className="a-mono py-1 text-a-fg-muted">{q.failed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetShell>
  );
}

export function AutomationFlowWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const steps = [
    {
      id: "order",
      label: "ORDER",
      ok: true,
    },
    {
      id: "worker",
      label: "WORKER",
      ok: !!snap?.workers.enabled,
    },
    {
      id: "bus",
      label: "EVENT BUS",
      ok: (snap?.events.outboxDlq ?? 0) === 0,
    },
    {
      id: "outbox",
      label: "OUTBOX",
      ok: (snap?.events.outboxLag ?? 0) < 50,
    },
    {
      id: "module",
      label: "MODULE",
      ok: !!snap?.db.ok,
    },
  ];
  return (
    <WidgetShell
      title="Automation Flow"
      subtitle="États dérivés — pas de workflow inventé"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[11px] font-medium",
                s.ok
                  ? "bg-a-success-soft text-a-success-fg"
                  : "bg-a-warning-soft text-a-warning-fg",
              )}
              title={s.ok ? "OK" : "Attention"}
            >
              {s.label} {s.ok ? "✓" : "⚠"}
            </span>
            {i < steps.length - 1 ? (
              <span className="text-a-fg-subtle" aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </WidgetShell>
  );
}

export function ThroughputWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const eps = snap?.events.eventsPerSecondEstimate ?? 0;
  const bars = Array.from({ length: 24 }, (_, i) => {
    const wave = Math.abs(Math.sin(i / 3 + eps)) * 0.4 + 0.2;
    return Math.min(1, wave + eps / 10);
  });
  return (
    <WidgetShell
      title="Event Throughput"
      subtitle="Estimate live · historique complet = lot suivant"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <div className="flex h-16 items-end gap-0.5" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-a-accent/70"
            style={{ height: `${Math.max(8, h * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        <MetricRow
          label="Current / s"
          value={eps.toFixed(2)}
        />
        <MetricRow
          label="Published / min"
          value={String(snap?.events.publishedLastMinute ?? "—")}
        />
        <MetricRow
          label="Failed jobs"
          value={String(snap?.jobs.failed ?? "—")}
        />
      </div>
    </WidgetShell>
  );
}

export function ApiPerfWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  return (
    <WidgetShell
      title="API Performance"
      subtitle={snap?.metrics.scrapePath}
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow
        label="p95"
        value={
          snap?.api.p95Ms != null ? `${Math.round(snap.api.p95Ms)} ms` : "—"
        }
      />
      <MetricRow
        label="Job success"
        value={String(snap?.metrics.jobSuccessTotal ?? "—")}
      />
      <MetricRow
        label="Job fail"
        value={String(snap?.metrics.jobFailTotal ?? "—")}
      />
      <MetricRow
        label="Retries"
        value={String(snap?.metrics.jobRetryTotal ?? "—")}
      />
      <MetricRow
        label="Admission rejects"
        value={String(snap?.metrics.admissionRejectTotal ?? "—")}
      />
    </WidgetShell>
  );
}

export function PostgresWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  return (
    <WidgetShell
      title="PostgreSQL"
      subtitle={snap?.db.ok ? "CONNECTED" : "ERROR"}
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow label="Status" value={snap?.db.ok ? "ok" : "down"} />
      <MetricRow label="Pool usage" value={pct(snap?.db.poolUsageRatio)} />
      <p className="mt-2 text-[10px] text-a-fg-subtle">
        Aucune donnée métier / secret exposé.
      </p>
    </WidgetShell>
  );
}

export function RedisWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const mem =
    snap?.redis.usedMemoryBytes != null
      ? `${Math.round(snap.redis.usedMemoryBytes / (1024 * 1024))} MB`
      : "—";
  return (
    <WidgetShell
      title="Redis"
      subtitle={
        !snap?.redis.configured
          ? "NOT CONFIGURED"
          : snap.redis.ok
            ? "CONNECTED"
            : "ERROR"
      }
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow
        label="Status"
        value={
          !snap?.redis.configured
            ? "n/a"
            : snap.redis.ok
              ? "ok"
              : "down"
        }
      />
      <MetricRow label="Memory" value={mem} />
    </WidgetShell>
  );
}

export function OutboxWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const o = snap?.events;
  return (
    <WidgetShell
      title="Outbox"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow label="Pending (lag)" value={String(o?.outboxLag ?? "—")} />
      <MetricRow label="DLQ" value={String(o?.outboxDlq ?? "—")} />
      <MetricRow
        label="Oldest"
        value={
          o?.outboxLagSeconds.oldest != null
            ? `${Math.round(o.outboxLagSeconds.oldest)}s`
            : "—"
        }
      />
      <MetricRow
        label="p50 / p95 / p99"
        value={
          o
            ? [
                o.outboxLagSeconds.p50,
                o.outboxLagSeconds.p95,
                o.outboxLagSeconds.p99,
              ]
                .map((v) => (v == null ? "—" : `${Math.round(v)}s`))
                .join(" / ")
            : "—"
        }
      />
    </WidgetShell>
  );
}

export function SchedulerPlaceholderWidget({
  loadState,
  asOf,
  onRefresh,
}: {
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  return (
    <WidgetShell
      title="Scheduler"
      subtitle="Contract ready · provider API prochain lot"
      state={loadState === "loaded" ? "empty" : loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Pas de métrique scheduler dédiée dans le snapshot actuel — widget
        enregistré pour extension module.
      </p>
    </WidgetShell>
  );
}

export function ResourcesWidget({
  snap,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  return (
    <WidgetShell
      title="System Resources"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <div className="flex justify-around gap-2">
        <MiniGauge label="CPU" ratio={snap?.cpu.usageRatio ?? null} />
        <MiniGauge label="RAM" ratio={snap?.ram.usageRatio ?? null} />
        <MiniGauge
          label="Jobs"
          ratio={
            snap
              ? Math.min(
                  1,
                  (snap.jobs.running + snap.jobs.pending) /
                    Math.max(1, snap.jobs.running + snap.jobs.pending + 4),
                )
              : null
          }
        />
      </div>
      <div className="mt-3 space-y-0.5">
        <MetricRow
          label="Tracing"
          value={snap?.tracing.enabled ? snap.tracing.tracerName : "off"}
        />
        <MetricRow label="Mode" value={snap?.systemMode ?? "—"} />
      </div>
    </WidgetShell>
  );
}

export function AlertsWidget({
  snap,
  thresholds,
  loadState,
  asOf,
  onRefresh,
}: {
  snap?: ThunderMonitorSnapshot;
  thresholds: ThunderAlertThresholds;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const hits = snap
    ? evaluateThunderAlerts(
        {
          cpuRatio: snap.cpu.usageRatio,
          ramRatio: snap.ram.usageRatio,
          queuePending: snap.jobs.pending,
          jobFailed: snap.jobs.failed,
          apiP95Ms: snap.api.p95Ms,
          outboxDlq: snap.events.outboxDlq,
        },
        thresholds,
      )
    : [];
  return (
    <WidgetShell
      title="Alerts"
      subtitle="Seuils prefs · non hardcodés"
      state={
        loadState === "loaded" && hits.length === 0 ? "empty" : loadState
      }
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <ul className="space-y-1.5">
        {hits.map((h) => (
          <li
            key={h.id}
            className="rounded-[var(--a-radius-sm)] bg-a-surface-3/60 px-2 py-1.5"
          >
            <p className="text-[11px] font-medium text-a-fg">
              {h.severity} · {h.code}
            </p>
            <p className="text-[10px] text-a-fg-muted">{h.message}</p>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function ActivityFeedWidget({
  loadState,
  asOf,
  onRefresh,
}: {
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const q = useQuery({
    queryKey: ["thunder-signals"],
    queryFn: async () => {
      const res = await fetch("/api/v1/thunder/signals", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 403) return { forbidden: true as const, items: [] };
      if (!res.ok) throw new Error(`signals ${res.status}`);
      const data = (await res.json()) as unknown;
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: unknown[] }).items
          : [];
      return { forbidden: false as const, items };
    },
    retry: false,
    refetchInterval: 15_000,
  });

  const state: WidgetLoadState = q.isPending
    ? "loading"
    : q.isError
      ? "unavailable"
      : q.data?.forbidden
        ? "forbidden"
        : (q.data?.items.length ?? 0) === 0
          ? "empty"
          : "loaded";

  return (
    <WidgetShell
      title="Activity Feed"
      subtitle="Thunder signals"
      state={state === "loading" ? loadState : state}
      asOf={asOf}
      onRefresh={() => {
        void q.refetch();
        onRefresh?.();
      }}
    >
      <ul className="space-y-1">
        {(q.data?.items ?? []).slice(0, 12).map((raw, i) => {
          const row = raw as Record<string, unknown>;
          const label =
            String(row.code ?? row.type ?? row.id ?? `signal-${i}`);
          const at = String(row.createdAt ?? row.at ?? "");
          return (
            <li
              key={String(row.id ?? i)}
              className="a-mono text-[10px] text-a-fg-muted"
            >
              {at ? `${at.slice(11, 19)} ` : ""}
              <span className="text-a-fg">{label}</span>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

export function IntegrationsWidget({
  loadState,
  asOf,
  onRefresh,
}: {
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const q = useQuery({
    queryKey: ["thunder-adapters-health"],
    queryFn: async () => {
      const res = await fetch("/api/v1/thunder/adapters/health", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (res.status === 403) return { forbidden: true as const, items: [] };
      if (!res.ok) throw new Error(`adapters ${res.status}`);
      const data = (await res.json()) as unknown;
      const items = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: unknown[] }).items
          : typeof data === "object" && data
            ? Object.entries(data as Record<string, unknown>).map(
                ([k, v]) => ({ id: k, ...(v as object) }),
              )
            : [];
      return { forbidden: false as const, items };
    },
    retry: false,
    refetchInterval: 20_000,
  });

  const state: WidgetLoadState = q.isPending
    ? "loading"
    : q.isError
      ? "unavailable"
      : q.data?.forbidden
        ? "forbidden"
        : (q.data?.items.length ?? 0) === 0
          ? "empty"
          : "loaded";

  return (
    <WidgetShell
      title="Integration Matrix"
      subtitle="Thunder adapters"
      state={state === "loading" ? loadState : state}
      asOf={asOf}
      onRefresh={() => {
        void q.refetch();
        onRefresh?.();
      }}
    >
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {(q.data?.items ?? []).map((raw, i) => {
          const row = raw as Record<string, unknown>;
          const id = String(row.id ?? row.key ?? row.name ?? i);
          const ok =
            row.ok === true ||
            row.status === "ok" ||
            row.status === "CONNECTED" ||
            row.healthy === true;
          return (
            <li
              key={id}
              className="rounded-[var(--a-radius-sm)] bg-a-surface-3/60 px-2 py-1.5"
            >
              <p className="truncate text-[11px] font-medium text-a-fg">{id}</p>
              <p
                className={cn(
                  "text-[10px]",
                  ok ? "text-a-success-fg" : "text-a-warning-fg",
                )}
              >
                {ok ? "CONNECTED" : "DEGRADED / UNKNOWN"}
              </p>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}

export { monitorState };

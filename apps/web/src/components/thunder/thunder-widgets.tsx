"use client";

import { useCallback, useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";
import {
  healthTone,
  type HealthItem,
  type WidgetLoadState,
} from "@/lib/dashboard-engine";
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
import {
  ThunderHealthContextMenu,
  type ThunderHealthMenuState,
} from "./thunder-health-context-menu";
import { MetricRow, MiniGauge, WidgetShell } from "./widget-shell";
import { useRepairSessionStore } from "@/stores/repair-session-store";

function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function monitorState(
  q: {
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    dataUpdatedAt: number;
    data?: unknown;
  },
  liveMode: boolean,
): WidgetLoadState {
  // Prefer showing last snapshot — never block UI on a hung fetch/SSE.
  if (q.data) {
    if (!liveMode && Date.now() - q.dataUpdatedAt > 60_000) return "stale";
    return "loaded";
  }
  if (q.isPending || q.isFetching) return "loading";
  if (q.isError) return "unavailable";
  return "loading";
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
  const [menu, setMenu] = useState<ThunderHealthMenuState | null>(null);
  const lastAction = useRepairSessionStore((s) => s.lastAction);
  const lines = useRepairSessionStore((s) => s.lines);
  const recentLogs = lines.slice(0, 4);

  const openMenu = useCallback(
    (e: MouseEvent, focusItem: HealthItem | null) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, focusItem });
    },
    [],
  );

  const statusLine =
    lastAction?.status === "running"
      ? `Repair · ${lastAction.intent}…`
      : lastAction?.status === "error"
        ? `Repair · ${lastAction.detail ?? "erreur"}`
        : lastAction?.status === "ok"
          ? `Repair · ${lastAction.detail ?? "ok"}`
          : null;

  return (
    <>
      <WidgetShell
        title="Thunder Health"
        subtitle={`${tone.label} · ${items.length} checks`}
        state={loadState}
        asOf={asOf}
        onRefresh={onRefresh}
        onContextMenu={(e) => openMenu(e, null)}
        actions={
          <button
            type="button"
            title="Actions Repair"
            aria-label="Actions Repair Thunder Health"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setMenu({
                x: rect.left,
                y: rect.bottom + 4,
                focusItem: null,
              });
            }}
          >
            <Wrench className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        }
      >
        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          {items.map((item) => {
            const t = healthTone(item.state);
            return (
              <li
                key={item.id}
                className="cursor-context-menu"
                title={`${item.detail ?? item.state} · clic droit → actions`}
                onContextMenu={(e) => openMenu(e, item)}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", t.dotClass)}
                    aria-hidden
                  />
                  <span className="truncate text-[length:var(--a-text-sm)] font-medium text-a-fg">
                    {item.label}
                  </span>
                </div>
                <p
                  className={cn(
                    "mt-0.5 pl-3 text-[length:var(--a-text-xs)]",
                    t.className,
                  )}
                >
                  {t.label}
                  {item.detail ? (
                    <span className="text-a-fg-subtle"> · {item.detail}</span>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>

        {statusLine || recentLogs.length > 0 ? (
          <div className="mt-3 border-t border-[color:var(--a-border-subtle)] pt-2">
            {statusLine ? (
              <p
                className={cn(
                  "text-[length:var(--a-text-xs)]",
                  lastAction?.status === "error"
                    ? "text-a-danger-fg"
                    : lastAction?.status === "running"
                      ? "text-a-fg-muted"
                      : "text-a-fg-subtle",
                )}
              >
                {statusLine}
              </p>
            ) : null}
            {recentLogs.length > 0 ? (
              <ul className="a-mono mt-1 max-h-16 space-y-0.5 overflow-auto text-[length:var(--a-text-xs)] text-a-fg-subtle">
                {recentLogs.map((l) => (
                  <li key={l.id}>
                    {l.at} · {l.text}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </WidgetShell>
      <ThunderHealthContextMenu
        open={menu}
        onClose={() => setMenu(null)}
        items={items}
        onRefresh={onRefresh}
      />
    </>
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
  const openBreakersList =
    snap?.breakers.filter((b) => b.state !== "CLOSED") ?? [];
  const closedBreakers =
    snap?.breakers.filter((b) => b.state === "CLOSED").length ?? 0;
  const openBreakers = openBreakersList.length;
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
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
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
            <p className="text-[length:var(--a-text-xs)] uppercase tracking-wider text-a-fg-subtle">
              {label}
            </p>
            <p className={cn("a-mono a-tabular mt-1 text-2xl font-medium", cls)}>
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
        <MetricRow label="Breakers CLOSED" value={String(closedBreakers)} />
        {openBreakersList.map((b) => (
          <p
            key={b.dependencyKey}
            className="a-mono text-[length:var(--a-text-xs)] text-a-warning-fg"
            title={b.openedAt ?? undefined}
          >
            {b.dependencyKey} · {b.state} · fail {b.failures}
          </p>
        ))}
        {openBreakers === 0 ? (
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Tous les breakers CLOSED
          </p>
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
  const hotDlq = (e?.outboxDlq ?? 0) > 0;
  const hotLag = (e?.outboxLag ?? 0) > 50;
  return (
    <WidgetShell
      title="Event Bus"
      subtitle="Outbox + processed"
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
      actions={
        <Link
          href="/repair"
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        >
          Repair
        </Link>
      }
    >
      <MetricRow
        label="Outbox lag"
        value={String(e?.outboxLag ?? "—")}
        hint={hotLag ? "élevé" : undefined}
      />
      <MetricRow
        label="Outbox DLQ"
        value={String(e?.outboxDlq ?? "—")}
        hint={hotDlq ? "action" : undefined}
      />
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
      {hotDlq || hotLag ? (
        <p className="mt-2 text-[length:var(--a-text-xs)] text-a-warning-fg">
          Lag / DLQ élevés — traiter via Repair (outbox).
        </p>
      ) : null}
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
      subtitle={snap?.workers.enabled ? "RUNNING" : "DISABLED"}
      state={rows.length === 0 && loadState === "loaded" ? "empty" : loadState}
      asOf={asOf}
      onRefresh={onRefresh}
      actions={
        <Link
          href="/repair"
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        >
          Repair
        </Link>
      }
    >
      <ul className="space-y-1">
        {rows.map((w) => {
          const idle = w.concurrency <= 0;
          return (
            <li
              key={w.family}
              className={cn(
                "flex items-center justify-between gap-2 rounded-[var(--a-radius-sm)] px-1.5 py-1 text-[length:var(--a-text-sm)]",
                idle && "bg-a-warning-soft/40",
              )}
            >
              <span className="truncate font-medium text-a-fg">{w.family}</span>
              <span
                className={cn(
                  "a-mono a-tabular",
                  idle ? "text-a-warning-fg" : "text-a-fg-muted",
                )}
              >
                c={w.concurrency}
                {idle ? " · idle" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 space-y-0.5 border-t border-[color:var(--a-border-subtle)] pt-2">
        <MetricRow
          label="Jobs running"
          value={String(snap?.jobs.running ?? "—")}
        />
        <MetricRow
          label="Completed"
          value={String(snap?.jobs.completed ?? "—")}
        />
        <MetricRow label="Failed" value={String(snap?.jobs.failed ?? "—")} />
        <MetricRow
          label="Paused (module)"
          value={String(snap?.jobs.pausedByModule ?? "—")}
        />
      </div>
      {!snap?.workers.enabled ? (
        <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
          Enable = config runtime (
          <span className="a-mono">REDIS_URL</span> ·{" "}
          <span className="a-mono">THUNDER_WORKERS_ENABLED</span>) — pas de
          toggle UI. Diagnostic L0 via Repair.
        </p>
      ) : null}
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
  const dlq = snap?.jobs.dlq ?? 0;
  return (
    <WidgetShell
      title="Queues"
      subtitle={`${snap?.jobs.pending ?? 0} pending · DLQ ${dlq}`}
      state={rows.length === 0 && loadState === "loaded" ? "empty" : loadState}
      asOf={asOf}
      onRefresh={onRefresh}
      actions={
        <Link
          href="/repair"
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        >
          Repair
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[length:var(--a-text-sm)]">
          <thead className="text-a-fg-subtle">
            <tr>
              <th className="pb-1 font-medium">Queue</th>
              <th className="pb-1 font-medium">Wait</th>
              <th className="pb-1 font-medium">Run</th>
              <th className="pb-1 font-medium">Fail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => {
              const hot = q.failed > 0 || q.pending > 50;
              return (
                <tr
                  key={q.family}
                  className={cn(
                    "border-t border-[color:var(--a-border-subtle)]",
                    hot && "bg-a-warning-soft/35",
                  )}
                >
                  <td className="py-1 font-medium text-a-fg">{q.family}</td>
                  <td
                    className={cn(
                      "a-mono a-tabular py-1",
                      q.pending > 50 ? "text-a-warning-fg" : "text-a-fg-muted",
                    )}
                  >
                    {q.pending}
                  </td>
                  <td className="a-mono a-tabular py-1 text-a-fg-muted">
                    {q.running}
                  </td>
                  <td
                    className={cn(
                      "a-mono a-tabular py-1",
                      q.failed > 0 ? "text-a-danger-fg" : "text-a-fg-muted",
                    )}
                  >
                    {q.failed}
                  </td>
                </tr>
              );
            })}
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
                "rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium",
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
  epsHistory = [],
}: {
  snap?: ThunderMonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
  /** Real poll samples (oldest → newest). */
  epsHistory?: number[];
}) {
  const eps = snap?.events.eventsPerSecondEstimate ?? 0;
  const series =
    epsHistory.length > 0
      ? epsHistory
      : eps > 0
        ? [eps]
        : [];
  const max = Math.max(0.01, ...series, eps);
  const bars =
    series.length > 0
      ? series
      : Array.from({ length: 8 }, () => 0);

  return (
    <WidgetShell
      title="Event Throughput"
      subtitle={
        series.length > 1
          ? `${series.length} samples · poll live`
          : "Estimate live · historique se remplit au poll"
      }
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <div className="flex h-16 items-end gap-0.5" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm bg-a-accent/70"
            style={{
              height: `${Math.max(8, (h / max) * 100)}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        <MetricRow label="Current / s" value={eps.toFixed(2)} />
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
      <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
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
  const hotDlq = (o?.outboxDlq ?? 0) > 0;
  const hotLag = (o?.outboxLag ?? 0) > 20;
  return (
    <WidgetShell
      title="Outbox"
      subtitle={
        hotDlq
          ? `DLQ ${o?.outboxDlq}`
          : hotLag
            ? `lag ${o?.outboxLag}`
            : undefined
      }
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
      actions={
        <Link
          href="/repair"
          className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
        >
          Repair
        </Link>
      }
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
      {hotDlq ? (
        <p className="mt-2 text-[length:var(--a-text-xs)] text-a-danger-fg">
          Outbox DLQ non vide — ouvrir Repair.
        </p>
      ) : null}
    </WidgetShell>
  );
}

/** Derived from workers/jobs snapshot — no dedicated scheduler API yet. */
export function SchedulerWidget({
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
  const families = snap?.workers.queues ?? [];
  const armed = families.filter((q) => q.concurrency > 0).length;
  const idle = families.filter((q) => q.concurrency === 0).length;
  const workersOn = snap?.workers.enabled === true;

  return (
    <WidgetShell
      title="Scheduler"
      subtitle={
        workersOn
          ? `Workers RUNNING · ${armed} familles armées`
          : `Workers DISABLED · ${armed} familles configurées`
      }
      state={loadState}
      asOf={asOf}
      onRefresh={onRefresh}
    >
      <MetricRow
        label="Workers"
        value={workersOn ? "ENABLED" : "DISABLED"}
      />
      <MetricRow label="Families armed" value={String(armed)} />
      <MetricRow label="Families idle (c=0)" value={String(idle)} />
      <MetricRow
        label="Jobs paused (module)"
        value={String(snap?.jobs.pausedByModule ?? "—")}
      />
      <MetricRow
        label="Pending / running"
        value={`${snap?.jobs.pending ?? "—"} / ${snap?.jobs.running ?? "—"}`}
      />
      <p className="mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
        Dérivé snapshot Thunder (workers + jobs) — pas de provider cron dédié.
      </p>
    </WidgetShell>
  );
}

/** @deprecated alias */
export function SchedulerPlaceholderWidget(props: {
  loadState: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
  snap?: ThunderMonitorSnapshot;
}) {
  return <SchedulerWidget {...props} />;
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
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              {h.severity} · {h.code}
            </p>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {h.message}
            </p>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

/** Signals — one-shot + manual refresh, hard timeout (no interval storm). */
export function ActivityFeedWidget({
  asOf,
  onRefresh,
}: {
  loadState?: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const [items, setItems] = useState<unknown[]>([]);
  const [state, setState] = useState<WidgetLoadState>("loading");

  const load = useCallback(async () => {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 5_000);
    try {
      const res = await fetch("/api/v1/thunder/signals", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (res.status === 403) {
        setState("forbidden");
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(`signals ${res.status}`);
      const data = (await res.json()) as unknown;
      const next = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: unknown[] }).items
          : [];
      setItems(next);
      setState(next.length === 0 ? "empty" : "loaded");
    } catch {
      setState("unavailable");
    } finally {
      window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WidgetShell
      title="Activity Feed"
      subtitle="Thunder signals"
      state={state}
      asOf={asOf}
      onRefresh={() => {
        void load();
        onRefresh?.();
      }}
    >
      <ul className="space-y-1">
        {items.slice(0, 12).map((raw, i) => {
          const row = raw as Record<string, unknown>;
          const label = String(
            row.code ?? row.type ?? row.id ?? `signal-${i}`,
          );
          const at = String(row.createdAt ?? row.at ?? "");
          return (
            <li
              key={String(row.id ?? i)}
              className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted"
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

/** Adapters — one-shot + manual refresh, hard timeout. */
export function IntegrationsWidget({
  asOf,
  onRefresh,
}: {
  loadState?: WidgetLoadState;
  asOf?: string;
  onRefresh?: () => void;
}) {
  const [items, setItems] = useState<
    { id: string; ok: boolean; message?: string }[]
  >([]);
  const [state, setState] = useState<WidgetLoadState>("loading");

  const load = useCallback(async () => {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 5_000);
    try {
      const res = await fetch("/api/v1/thunder/adapters/health", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      });
      if (res.status === 403) {
        setState("forbidden");
        setItems([]);
        return;
      }
      if (!res.ok) throw new Error(`adapters ${res.status}`);
      const data = (await res.json()) as unknown;
      const rawList: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown }).items)
          ? (data as { items: unknown[] }).items
          : typeof data === "object" && data && "adapters" in data
            ? Object.entries(
                (data as { adapters: Record<string, unknown> }).adapters,
              ).map(([id, v]) =>
                typeof v === "object" && v
                  ? { adapterId: id, ...(v as object) }
                  : { adapterId: id, ok: v },
              )
            : [];

      const next = rawList.map((raw, i) => {
        const row = raw as Record<string, unknown>;
        const health =
          row.health && typeof row.health === "object"
            ? (row.health as Record<string, unknown>)
            : null;
        const id = String(
          row.adapterId ?? row.id ?? row.key ?? row.name ?? `adapter-${i}`,
        );
        const ok =
          row.ok === true ||
          health?.ok === true ||
          row.status === "ok" ||
          row.status === "CONNECTED" ||
          row.healthy === true;
        const message = String(
          health?.message ?? row.message ?? row.detail ?? "",
        );
        return { id, ok, message: message || undefined };
      });
      setItems(next);
      setState(next.length === 0 ? "empty" : "loaded");
    } catch {
      setState("unavailable");
    } finally {
      window.clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <WidgetShell
      title="Integration Matrix"
      subtitle="Thunder adapters"
      state={state}
      asOf={asOf}
      onRefresh={() => {
        void load();
        onRefresh?.();
      }}
    >
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {items.map((row) => (
          <li
            key={row.id}
            className="rounded-[var(--a-radius-sm)] bg-a-surface-3/60 px-2 py-1.5"
            title={row.message}
          >
            <p className="truncate text-[length:var(--a-text-sm)] font-medium text-a-fg">
              {row.id}
            </p>
            <p
              className={cn(
                "text-[length:var(--a-text-xs)]",
                row.ok ? "text-a-success-fg" : "text-a-warning-fg",
              )}
            >
              {row.ok ? "CONNECTED" : "DEGRADED / UNKNOWN"}
            </p>
            {row.message ? (
              <p className="mt-0.5 truncate text-[length:var(--a-text-xs)] text-a-fg-subtle">
                {row.message}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export { monitorState };

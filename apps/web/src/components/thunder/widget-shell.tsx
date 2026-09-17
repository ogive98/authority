"use client";

import type { MouseEvent, ReactNode } from "react";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import type { WidgetLoadState } from "@/lib/dashboard-engine";
import { cn } from "@/lib/utils";

export function WidgetShell({
  title,
  subtitle,
  state,
  asOf,
  onRefresh,
  actions,
  children,
  className,
  onContextMenu,
}: {
  title: string;
  subtitle?: string;
  state: WidgetLoadState;
  asOf?: string | null;
  onRefresh?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
}) {
  return (
    <section
      className={cn(
        "a-card flex h-full min-h-[11rem] flex-col overflow-hidden",
        className,
      )}
      aria-busy={state === "loading"}
      aria-label={title}
      onContextMenu={onContextMenu}
    >
      <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[color:var(--a-border-subtle)] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-[length:var(--a-text-md)] font-medium tracking-[-0.02em] text-a-fg">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[length:var(--a-text-sm)] text-a-fg-subtle">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {onRefresh ? (
            <button
              type="button"
              title="Refresh"
              aria-label={`Rafraîchir ${title}`}
              onClick={onRefresh}
              className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          ) : null}
          {actions ?? (
            <span className="inline-flex h-7 w-7 items-center justify-center text-a-fg-subtle">
              <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          )}
        </div>
      </header>

      <div className="a-ios-scroll min-h-0 flex-1 overflow-auto p-3">
        {state === "loading" ? (
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Chargement…
          </p>
        ) : null}
        {state === "forbidden" ? (
          <p className="text-[length:var(--a-text-sm)] text-a-warning-fg">
            Permission refusée
          </p>
        ) : null}
        {state === "error" || state === "unavailable" ? (
          <div className="space-y-1">
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-danger-fg">
              SERVICE UNAVAILABLE
            </p>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Snapshot Thunder indisponible — retry automatique.
            </p>
          </div>
        ) : null}
        {state === "empty" ? (
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Aucune donnée
          </p>
        ) : null}
        {state === "loaded" || state === "stale" ? children : null}
      </div>

      {asOf ? (
        <footer className="shrink-0 border-t border-[color:var(--a-border-subtle)] px-3 py-1.5">
          <p
            className={cn(
              "a-mono a-tabular text-[length:var(--a-text-xs)] text-a-fg-subtle",
              state === "stale" && "text-a-warning-fg",
            )}
          >
            {state === "stale" ? "STALE · " : ""}
            {asOf}
          </p>
        </footer>
      ) : null}
    </section>
  );
}

export function MetricRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {label}
      </span>
      <span className="a-mono a-tabular text-[length:var(--a-text-md)] font-medium text-a-fg">
        {value}
        {hint ? (
          <span className="ml-1 text-[length:var(--a-text-xs)] font-normal text-a-fg-subtle">
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function MiniGauge({
  label,
  ratio,
}: {
  label: string;
  ratio: number | null;
}) {
  const pct =
    ratio == null ? null : Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = pct == null ? 0 : (pct / 100) * c;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 48 48" className="h-14 w-14" aria-hidden>
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          className="text-a-surface-4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 24 24)"
          className="text-a-accent"
        />
        <text
          x="24"
          y="27"
          textAnchor="middle"
          fill="var(--a-fg)"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {pct == null ? "—" : pct}
        </text>
      </svg>
      <span className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
        {label}
      </span>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

type Props = {
  score: number;
  label?: string;
  sublabel?: string;
  findings?: number;
  className?: string;
};

/** Aggressive health gauge — green OK, amber warn, red alert + pulse. */
export function RepairHealthGauge({
  score,
  label = "Santé globale",
  sublabel,
  findings = 0,
  className,
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const r = 58;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const level =
    clamped >= 85 ? "ok" : clamped >= 60 ? "warn" : "danger";
  const stroke =
    level === "ok"
      ? "var(--a-accent)"
      : level === "warn"
        ? "var(--a-warning)"
        : "var(--a-danger)";
  const tone =
    level === "ok"
      ? "text-a-success"
      : level === "warn"
        ? "text-a-warning"
        : "text-a-danger";

  return (
    <div
      className={cn(
        "repair-panel relative flex items-center gap-5 overflow-hidden rounded-[var(--a-radius-lg)] bg-[var(--a-gradient-canvas)] p-5",
        level === "danger" && "repair-gauge-danger-glow",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-30 blur-2xl",
          level === "ok" && "bg-a-accent",
          level === "warn" && "bg-a-warning",
          level === "danger" && "bg-a-danger repair-spark",
        )}
        aria-hidden
      />
      <div className="relative h-[148px] w-[148px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="var(--a-surface-4)"
            strokeWidth="12"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className={cn(
              "repair-gauge-arc",
              level === "danger" && "repair-gauge-arc-alert",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "a-mono text-[length:var(--a-text-3xl)] font-semibold tabular-nums",
              tone,
            )}
          >
            {clamped}
            <span className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              %
            </span>
          </span>
          {level === "danger" ? (
            <span className="text-[length:var(--a-text-xs)] font-medium text-a-danger">
              ALERTE
            </span>
          ) : null}
        </div>
      </div>
      <div className="relative z-[1] min-w-0 flex-1">
        <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
          Thunder Shield
        </p>
        <p className="text-[length:var(--a-text-xl)] font-semibold tracking-tight text-a-fg">
          {label}
        </p>
        {sublabel ? (
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            {sublabel}
          </p>
        ) : null}
        {findings > 0 ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-a-danger-soft px-2.5 py-1 text-[length:var(--a-text-xs)] font-medium text-a-danger-fg">
            <span className="repair-dot-pulse h-1.5 w-1.5 rounded-full bg-a-danger" />
            {findings} finding(s) ouvert(s)
          </p>
        ) : (
          <p className="mt-3 text-[length:var(--a-text-xs)] font-medium text-a-success-fg">
            Système stable
          </p>
        )}
        {/* Mini spark bars */}
        <div className="mt-4 flex h-8 items-end gap-1" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => {
            const h = 20 + ((i * 37) % 60);
            const hot = level !== "ok" && i > 10;
            return (
              <span
                key={i}
                className={cn(
                  "repair-spark-bar w-1.5 rounded-sm",
                  hot ? "bg-a-danger/80" : "bg-a-accent/50",
                )}
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 80}ms`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

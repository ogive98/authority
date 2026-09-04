import { cn } from "@/lib/utils";

export type AKpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "warning" | "danger" | "neutral";
};

/** KPI strip card — solid surface, tabular value, color on delta text only. */
export function AKpiCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
}: AKpiCardProps) {
  const tone =
    deltaTone === "success"
      ? "text-a-success"
      : deltaTone === "warning"
        ? "text-a-warning"
        : deltaTone === "danger"
          ? "text-a-danger"
          : "text-a-fg-muted";

  return (
    <article className="a-card p-[var(--a-space-5)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">{label}</p>
        {delta ? (
          <span
            className={cn(
              "a-mono text-[length:var(--a-text-xs)] font-medium",
              tone,
            )}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className="a-mono a-tabular mt-2 text-[length:var(--a-text-2xl)] font-semibold tracking-tight">
        {value}
      </p>
    </article>
  );
}

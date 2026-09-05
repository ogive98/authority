import { cn } from "@/lib/utils";

export type AKpiCardProps = {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "success" | "warning" | "danger" | "neutral";
  /** Field ACL: hide the numeric value (wage / protected amount). */
  masked?: boolean;
};

/** KPI strip — glass card; amounts stay solid tabular (readable). */
export function AKpiCard({
  label,
  value,
  delta,
  deltaTone = "neutral",
  masked = false,
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
    <article className="a-card relative overflow-hidden p-[var(--a-space-5)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-a-accent/40"
        aria-hidden
      />
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
      <p
        className="a-mono a-tabular mt-2 text-[length:var(--a-text-2xl)] font-semibold tracking-tight text-a-fg"
        aria-label={masked ? `${label} masqué` : undefined}
      >
        {masked ? "••••" : value}
      </p>
    </article>
  );
}

import { cn } from "@/lib/utils";
import {
  PRINT_JOB_STATUS_LABEL,
  type PrintJob,
  type PrintJobStatus,
} from "@/lib/print-job-mock";

const statusClass: Record<PrintJobStatus, string> = {
  queued: "text-a-fg-muted",
  running: "text-a-accent",
  done: "text-a-success",
  failed: "text-a-danger",
  plan_c: "text-a-warning",
};

export type AJobProgressProps = {
  job: PrintJob | null;
  className?: string;
};

/** Job chrome — statut = texte coloré, pas un gros cadre. */
export function AJobProgress({ job, className }: AJobProgressProps) {
  if (!job) {
    return (
      <p className={cn("text-[length:var(--a-text-sm)] text-a-fg-muted", className)}>
        Aucun job d’impression.
      </p>
    );
  }

  const pct = Math.min(100, Math.max(0, job.progress));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
          {job.id} · file {job.queue}
        </p>
        <p
          className={cn(
            "text-[length:var(--a-text-sm)] font-medium",
            statusClass[job.status],
          )}
        >
          {PRINT_JOB_STATUS_LABEL[job.status]}
        </p>
      </div>
      <div
        className="h-1 overflow-hidden rounded-[var(--a-radius-sm)] bg-a-surface-3"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Progression impression"
      >
        <div
          className="h-full bg-a-accent transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">{job.message}</p>
      {job.reprintOf ? (
        <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
          reprint of {job.reprintOf}
        </p>
      ) : null}
    </div>
  );
}

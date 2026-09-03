import { cn } from "@/lib/utils";

export type ASkeletonProps = {
  className?: string;
  /** Number of lines (default block). */
  lines?: number;
};

/** Pulse skeleton — prefers-reduced-motion respected via CSS. */
export function ASkeleton({ className, lines }: ASkeletonProps) {
  if (lines && lines > 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)} aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 animate-pulse rounded-[var(--a-radius-sm)] bg-a-surface-4",
              "motion-reduce:animate-none",
              i === lines - 1 ? "w-2/3" : "w-full",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--a-radius-md)] bg-a-surface-4",
        "motion-reduce:animate-none",
        className,
      )}
      aria-hidden
    />
  );
}

export function ASkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-4",
        className,
      )}
      aria-busy="true"
      aria-label="Chargement"
    >
      <ASkeleton className="mb-3 h-4 w-1/3" />
      <ASkeleton lines={3} />
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AScreenHeaderProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Gates /dev — sticky bar. Module pages: false. */
  sticky?: boolean;
};

/**
 * Page chrome: title left, primary CTA right.
 * Use inside AppShell (modules) and /dev gates.
 */
export function AScreenHeader({
  kicker,
  title,
  description,
  actions,
  sticky = false,
}: AScreenHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 border-b border-a-border-subtle a-glass px-[var(--a-space-6)] py-[var(--a-space-5)]",
        sticky && "sticky top-14 z-[var(--a-z-sticky)]",
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {kicker}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[length:var(--a-text-lg)] font-medium tracking-tight text-a-fg",
            kicker && "mt-1",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] font-normal text-a-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

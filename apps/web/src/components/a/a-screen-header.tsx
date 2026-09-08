import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AScreenHeaderProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
};

/** macOS page title — no chrome frame. */
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
        "flex flex-wrap items-end justify-between gap-4 px-6 pb-3 pt-5 md:px-8",
        sticky && "sticky top-12 z-[var(--a-z-sticky)] bg-[var(--a-gradient-canvas)]/80 backdrop-blur-xl",
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-a-fg-subtle">
            {kicker}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[22px] font-semibold tracking-[-0.022em] text-a-fg",
            kicker && "mt-1",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] text-a-fg-muted">
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

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AScreenHeaderProps = {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Gates /dev — sticky bar like tokens. Module pages: false. */
  sticky?: boolean;
};

/**
 * Locked page chrome: title left, actions right.
 * Use inside AppShell (modules) and /dev gates. Do not invent a second header.
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
        "flex flex-wrap items-center justify-between gap-4 border-b border-a-border-subtle px-[var(--a-space-6)] py-[var(--a-space-4)]",
        sticky &&
          "sticky top-0 z-[var(--a-z-sticky)] bg-a-surface-1/90 backdrop-blur-md",
      )}
    >
      <div className="min-w-0">
        {kicker ? (
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-widest text-a-fg-subtle">
            {kicker}
          </p>
        ) : null}
        <h1
          className={cn(
            "text-[length:var(--a-text-xl)] font-semibold",
            kicker && "mt-1",
          )}
          style={{ letterSpacing: "var(--a-tracking-title)" }}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-xl text-[length:var(--a-text-sm)] text-a-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

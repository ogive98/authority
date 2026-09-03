import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AButton } from "@/components/a/a-button";

export type AEmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** When false, CTA is hidden (no permission). */
  canAct?: boolean;
  icon?: ReactNode;
  className?: string;
};

export function AEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  canAct = true,
  icon,
  className,
}: AEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-6)]",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="text-a-fg-subtle" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div>
        <h3 className="text-[length:var(--a-text-lg)] font-medium text-a-fg">
          {title}
        </h3>
        {description ? (
          <p className="mt-1 max-w-md text-[length:var(--a-text-sm)] text-a-fg-muted">
            {description}
          </p>
        ) : null}
      </div>
      {canAct && actionLabel && onAction ? (
        <AButton type="button" size="sm" onClick={onAction}>
          {actionLabel}
        </AButton>
      ) : null}
    </div>
  );
}

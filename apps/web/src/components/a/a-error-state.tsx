"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AButton } from "@/components/a/a-button";

export type AErrorStateProps = {
  title?: string;
  message: string;
  correlationId?: string;
  retryable?: boolean;
  onRetry?: () => void;
  /** Technical detail (folded by default). */
  detail?: string;
  className?: string;
  icon?: ReactNode;
};

export function AErrorState({
  title = "Une erreur est survenue",
  message,
  correlationId,
  retryable = false,
  onRetry,
  detail,
  className,
  icon,
}: AErrorStateProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--a-radius-lg)] border border-a-danger/40 bg-a-surface-2 p-[var(--a-space-6)]",
        className,
      )}
      role="alert"
    >
      {icon ? <div className="text-a-danger" aria-hidden>{icon}</div> : null}
      <div>
        <h3 className="text-[length:var(--a-text-lg)] font-medium text-a-fg">
          {title}
        </h3>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {message}
        </p>
        {correlationId ? (
          <p className="a-mono mt-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
            correlationId: {correlationId}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {retryable && onRetry ? (
          <AButton type="button" size="sm" onClick={onRetry}>
            Réessayer
          </AButton>
        ) : null}
        {detail ? (
          <AButton
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Masquer le détail" : "Détail technique"}
          </AButton>
        ) : null}
      </div>
      {open && detail ? (
        <pre className="a-mono max-h-40 overflow-auto rounded-[var(--a-radius-md)] bg-a-surface-3 p-3 text-[length:var(--a-text-xs)] text-a-fg-muted whitespace-pre-wrap">
          {detail}
        </pre>
      ) : null}
    </div>
  );
}

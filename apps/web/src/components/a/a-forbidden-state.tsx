import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AForbiddenStateProps = {
  title?: string;
  message?: string;
  className?: string;
  icon?: ReactNode;
};

export function AForbiddenState({
  title = "Accès refusé",
  message = "Vous n’avez pas la permission d’afficher cette ressource. Ce n’est pas une erreur technique.",
  className,
  icon,
}: AForbiddenStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-[var(--a-radius-lg)] border border-a-border-subtle bg-a-surface-2 p-[var(--a-space-6)]",
        className,
      )}
      role="status"
    >
      {icon ? (
        <div className="text-a-warning" aria-hidden>
          {icon}
        </div>
      ) : null}
      <h3 className="text-[length:var(--a-text-lg)] font-medium text-a-fg">
        {title}
      </h3>
      <p className="max-w-md text-[length:var(--a-text-sm)] text-a-fg-muted">
        {message}
      </p>
      <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
        HTTP 403
      </p>
    </div>
  );
}

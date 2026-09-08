import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BannerTone = "info" | "warning" | "danger" | "spectre";

const toneClass: Record<BannerTone, string> = {
  info: "bg-a-info-soft text-a-info-fg",
  warning: "bg-a-warning-soft text-a-warning-fg",
  danger: "bg-a-danger-soft text-a-danger-fg",
  spectre: "bg-a-spectre-muted text-a-spectre-fg",
};

export type AStatusBannerProps = {
  tone?: BannerTone;
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

export function AStatusBanner({
  tone = "info",
  title,
  description,
  icon,
  className,
  children,
}: AStatusBannerProps) {
  return (
    <div
      className={cn(
        "a-card flex items-start gap-3 px-3 py-2.5",
        toneClass[tone],
        className,
      )}
      role="status"
    >
      {icon ? <span className="mt-0.5 shrink-0" aria-hidden>{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--a-text-sm)] font-medium">{title}</p>
        {description ? (
          <p className="mt-0.5 text-[length:var(--a-text-xs)] opacity-90">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function AOfflineBanner({
  sseLost,
  className,
}: {
  sseLost?: boolean;
  className?: string;
}) {
  return (
    <AStatusBanner
      tone="danger"
      title={sseLost ? "Flux temps réel coupé" : "Hors ligne"}
      description={
        sseLost
          ? "Les notifications SSE sont indisponibles. Les actions locales restent possibles."
          : "Connexion réseau perdue. Les modifications seront synchronisées au retour."
      }
      className={className}
    />
  );
}

export function ADegradedBanner({ className }: { className?: string }) {
  return (
    <AStatusBanner
      tone="warning"
      title="Mode dégradé (Plan C)"
      description="Capacité limitée — certaines opérations sont en lecture seule ou différées."
      className={className}
    />
  );
}

export function AMaintenanceBanner({
  moduleName,
  className,
}: {
  moduleName?: string;
  className?: string;
}) {
  return (
    <AStatusBanner
      tone="spectre"
      title={
        moduleName
          ? `Maintenance — ${moduleName}`
          : "Maintenance en cours"
      }
      description="Ce module est temporairement indisponible. Réessayez plus tard."
      className={className}
    />
  );
}

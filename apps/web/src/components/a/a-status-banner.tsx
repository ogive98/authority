import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type BannerTone = "info" | "warning" | "danger" | "spectre";

const toneClass: Record<BannerTone, string> = {
  info: "border-a-info/40 bg-a-info/10 text-a-fg",
  warning: "border-a-warning/50 bg-a-warning/15 text-a-fg",
  danger: "border-a-danger/40 bg-a-danger/10 text-a-fg",
  spectre: "border-a-spectre/50 bg-a-spectre-muted text-a-spectre-fg",
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
        "flex items-start gap-3 rounded-[var(--a-radius-md)] border px-3 py-2.5",
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

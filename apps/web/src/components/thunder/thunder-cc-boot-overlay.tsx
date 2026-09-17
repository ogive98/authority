"use client";

import { useUiT } from "@/lib/i18n/route-labels";
import { useThunderCcPowerStore } from "@/stores/thunder-cc-power-store";
import { cn } from "@/lib/utils";

/**
 * Boot chrome for Thunder Command Center — temporary overlay (not Soft Glass SoT).
 * Horizontal gauge (download-style) while CC wakes from sleep.
 */
export function ThunderCcBootOverlay() {
  const { t } = useUiT();
  const power = useThunderCcPowerStore((s) => s.power);
  const progress = useThunderCcPowerStore((s) => s.progress);
  const label = useThunderCcPowerStore((s) => s.label);

  if (power !== "booting") return null;

  const pct = Math.max(0, Math.min(100, progress));

  return (
    <div
      className="fixed inset-0 z-[calc(var(--a-z-modal)+20)] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={t("Démarrage Thunder Core")}
    >
      <div
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--a-canvas)_72%,transparent)]"
        style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        aria-hidden
      />
      <div className="relative w-full max-w-md space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-[length:var(--a-text-md)] font-medium tracking-[-0.02em] text-a-fg">
            {t("Thunder Core")}
          </p>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            {label || t("Démarrage Command Center…")}
          </p>
        </div>

        <div className="space-y-2">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-a-surface-3"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className={cn(
                "h-full rounded-full bg-a-accent transition-[width] duration-300 ease-out",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
            <span>{t("Command Center")}</span>
            <span className="a-tabular">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

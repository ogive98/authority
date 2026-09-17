"use client";

import { usePrefsStore, type Density } from "@/stores/prefs-store";
import { useUiT } from "@/lib/i18n/route-labels";
import { cn } from "@/lib/utils";

const DENSITY_CYCLE: Density[] = ["comfortable", "compact", "spacious"];

export type AListUtilitiesProps = {
  /** Apply current search/filters (ZIP « Filter »). */
  onFilter?: () => void;
  className?: string;
};

/**
 * D294 ERP list utilities — Filter · Group · Columns · Density (quiet text).
 * Group/Columns are placeholders until saved-views land; Density wires Prefs.
 */
export function AListUtilities({ onFilter, className }: AListUtilitiesProps) {
  const { t } = useUiT();
  const density = usePrefsStore((s) => s.density);
  const setDensity = usePrefsStore((s) => s.setDensity);

  function cycleDensity() {
    const i = DENSITY_CYCLE.indexOf(density);
    const next = DENSITY_CYCLE[(i + 1) % DENSITY_CYCLE.length] ?? "comfortable";
    setDensity(next);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 sm:gap-2",
        className,
      )}
    >
      <button
        type="button"
        className="a-action-quiet px-2 py-1 text-[length:var(--a-text-sm)]"
        onClick={onFilter}
      >
        {t("Filtrer")}
      </button>
      <button
        type="button"
        className="a-action-quiet px-2 py-1 text-[length:var(--a-text-sm)] text-a-fg-subtle"
        disabled
        title={t("Bientôt")}
      >
        {t("Grouper")}
      </button>
      <button
        type="button"
        className="a-action-quiet px-2 py-1 text-[length:var(--a-text-sm)] text-a-fg-subtle"
        disabled
        title={t("Bientôt")}
      >
        {t("Colonnes")}
      </button>
      <button
        type="button"
        className="a-action-quiet px-2 py-1 text-[length:var(--a-text-sm)]"
        onClick={cycleDensity}
        title={`${t("Densité")}: ${density}`}
      >
        {t("Densité")}
      </button>
    </div>
  );
}

/** ZIP subtitle: « N records · professional ERP list » — live count only. */
export function erpListDescription(
  count: number | null | undefined,
  detail?: string,
): string {
  if (count == null) return detail ?? "";
  const base = `${count} enregistrement${count === 1 ? "" : "s"}`;
  return detail ? `${base} · ${detail}` : base;
}

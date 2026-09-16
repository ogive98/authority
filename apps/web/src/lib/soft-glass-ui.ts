import { cn } from "@/lib/utils";

/**
 * Filter chips (D228) — soulignement orange (couleur icônes), pas de pastille teal.
 */
export function softChipClass(active: boolean): string {
  return cn(
    "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium",
    active && "is-active text-a-fg",
  );
}

/**
 * Module section tabs — underline icon color (D228).
 */
export function softUnderlineTabClass(active: boolean): string {
  return cn(
    "a-action-quiet inline-flex items-center gap-2 px-1 pb-2 pt-0.5 text-[length:var(--a-text-sm)] font-medium",
    active && "is-active text-a-fg",
  );
}

/** Table host — underlay only, zero frame. Prefer `ASoftTable` on new screens. */
export const softTableWrap =
  "a-underlay overflow-x-auto rounded-[var(--a-radius-md)]";

export const softThead =
  "bg-a-surface-3/55 text-a-fg-muted";

export const softTr =
  "transition-colors hover:bg-a-surface-3/45";

/** Stacked list host (D186) — underlay, no card border. */
export const softList =
  "a-underlay space-y-0.5 rounded-[var(--a-radius-md)] p-1.5";

/** Soft Glass list row — hover underlay only. */
export const softListRow =
  "flex flex-wrap items-center gap-3 rounded-[var(--a-radius-sm)] px-3 py-3 transition-colors hover:bg-a-surface-3/55";

/** Form / panel block without framed card. */
export const softPanel =
  "a-underlay space-y-4 rounded-[var(--a-radius-md)] p-4 md:p-5";

/** KPI / nav tile — Soft Glass underlay (portal + shell). */
export const softTile =
  "a-underlay rounded-[var(--a-radius-md)] px-4 py-3 transition-colors hover:bg-a-surface-3/55";

/** Secondary text button — quiet underline (D228). */
export const softGhostBtn =
  "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium";

/** Native select — Soft Glass readable control (`.a-select` in globals.css). */
export const softSelect = "a-select";

/** Icon + label row for Soft Glass forms. */
export const softFieldLabel = "a-field-label";

/** Page body padding consistent with shell. */
export const softPageBody =
  "space-y-5 p-4 md:space-y-6 md:p-6";

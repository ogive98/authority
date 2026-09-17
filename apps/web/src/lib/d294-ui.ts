import { cn } from "@/lib/utils";

/**
 * D294 shared UI class helpers — quiet chips, tables, panels (opaque surfaces).
 */
export function softChipClass(active: boolean): string {
  return cn(
    "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium",
    active && "is-active text-a-fg",
  );
}

/**
 * Module section tabs — underline icon color (D228 / D294).
 */
export function softUnderlineTabClass(active: boolean): string {
  return cn(
    "a-action-quiet inline-flex items-center gap-2 px-1 pb-2 pt-0.5 text-[length:var(--a-text-sm)] font-medium",
    active && "is-active text-a-fg",
  );
}

/** Table host — opaque underlay. Prefer `ASoftTable` on new screens. */
export const softTableWrap =
  "a-underlay overflow-x-auto rounded-[var(--a-radius-lg)]";

export const softThead =
  "sticky top-0 z-[1] bg-a-surface-3 text-a-fg-muted";

export const softTr =
  "border-b border-[color:var(--a-border-subtle)] transition-colors hover:bg-a-surface-3/55 last:border-b-0";

/** Stacked list host — opaque panel. */
export const softList =
  "a-underlay space-y-0.5 rounded-[var(--a-radius-lg)] p-1.5";

/** List row — hover underlay only. */
export const softListRow =
  "flex flex-wrap items-center gap-3 rounded-[var(--a-radius-md)] px-3 py-3 transition-colors hover:bg-a-surface-3/55";

/** Form / panel block — D294 card. */
export const softPanel = "a-card space-y-4 p-4 md:p-5";

/** KPI / nav tile — D294 card. */
export const softTile =
  "a-card px-4 py-3 transition-colors hover:bg-a-surface-3/55";

/** Secondary text button — quiet underline (D228). */
export const softGhostBtn =
  "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium";

/** Native select — `.a-select` in globals.css. */
export const softSelect = "a-select";

/** Icon + label row for forms. */
export const softFieldLabel = "a-field-label";

/** Page body padding consistent with shell. */
export const softPageBody = "space-y-5 p-4 md:space-y-6 md:p-6";

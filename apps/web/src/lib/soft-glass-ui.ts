import { cn } from "@/lib/utils";

/** Soft Glass filter chips — no underline / border chrome (D163). */
export function softChipClass(active: boolean): string {
  return cn(
    "rounded-md px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium transition-colors",
    active
      ? "bg-a-accent text-white"
      : "bg-a-surface-3 text-a-fg-muted hover:bg-a-surface-4 hover:text-a-fg",
  );
}

/**
 * Module section tabs (D184) — no filled teal frame.
 * White/light icon + teal underline when active.
 */
export function softUnderlineTabClass(active: boolean): string {
  return cn(
    "inline-flex items-center gap-2 border-b-2 px-1 pb-2 pt-0.5 text-[length:var(--a-text-sm)] font-medium transition-colors",
    active
      ? "border-a-accent text-a-fg"
      : "border-transparent text-a-fg-muted hover:text-a-fg",
  );
}

/** Table host — underlay only, zero frame. */
export const softTableWrap =
  "a-underlay overflow-x-auto rounded-md";

export const softThead =
  "bg-a-surface-3/55 text-a-fg-muted";

export const softTr =
  "transition-colors hover:bg-a-surface-3/45";

/** Stacked list host (D186) — underlay, no card border. */
export const softList =
  "a-underlay space-y-0.5 rounded-md p-1.5";

/** Soft Glass list row — hover underlay only. */
export const softListRow =
  "flex flex-wrap items-center gap-3 rounded-md px-3 py-3 transition-colors hover:bg-a-surface-3/55";

/** Form / panel block without framed card. */
export const softPanel = "a-underlay space-y-4 rounded-md p-4 md:p-5";

/** KPI / nav tile — Soft Glass underlay (portal + shell). */
export const softTile =
  "a-underlay rounded-md px-4 py-3 transition-colors hover:bg-a-accent-muted/40";

/** Secondary text button without border chrome. */
export const softGhostBtn =
  "rounded-[var(--a-radius-sm)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg transition-colors hover:bg-a-surface-4";

/** Native select aligned Soft Glass. */
export const softSelect =
  "flex h-9 w-full rounded-md bg-a-surface-3 px-3 text-[length:var(--a-text-sm)] text-a-fg outline-none ring-a-accent focus:ring-2";

/** Page body padding consistent with shell. */
export const softPageBody =
  "space-y-5 p-4 md:space-y-6 md:p-6";

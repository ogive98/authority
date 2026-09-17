import type { WidgetGridPosition, WidgetSizeUnit } from "./types";

export const GRID = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
} as const;

/** Fixed lg row track (rem) — never minmax(auto) (collapses with h-full). */
export const THUNDER_ROW_REM = 11;
export const THUNDER_ROW_COMPACT_REM = 9;
export const THUNDER_GAP_REM = 0.75;
export const THUNDER_GAP_COMPACT_REM = 0.5;

/**
 * Min inline size (px) of the CC grid container for free 12-col x/y.
 * Below this: comfort flow (1→2 cols) — viewport lg is NOT enough when dock/sidebar eat space.
 */
export const THUNDER_FREE_LAYOUT_MIN_PX = 960;

export function clampSize(
  size: WidgetSizeUnit,
  min: WidgetSizeUnit,
  max: WidgetSizeUnit,
): WidgetSizeUnit {
  return {
    w: Math.min(max.w, Math.max(min.w, size.w)),
    h: Math.min(max.h, Math.max(min.h, size.h)),
  };
}

export function clampPosition(
  pos: WidgetGridPosition,
  columns: number,
): WidgetGridPosition {
  const w = Math.min(Math.max(1, pos.w), columns);
  const h = Math.max(1, pos.h || 1);
  const x = Math.max(0, Math.min(pos.x, columns - w));
  const y = Math.max(0, pos.y || 0);
  return { x, y, w, h };
}

export function colSpanClass(w: number): string {
  const map: Record<number, string> = {
    1: "col-span-1",
    2: "col-span-2",
    3: "col-span-3",
    4: "col-span-4",
    5: "col-span-5",
    6: "col-span-6",
    7: "col-span-7",
    8: "col-span-8",
    9: "col-span-9",
    10: "col-span-10",
    11: "col-span-11",
    12: "col-span-12",
  };
  return map[Math.min(12, Math.max(1, w))] ?? "col-span-4";
}

/** CSS vars (lg+ via .thunder-cc-tile) + explicit minHeight so tiles cannot collapse. */
export function thunderGridItemStyle(
  pos: WidgetGridPosition,
  compact = false,
): Record<string, string> {
  const p = clampPosition(pos, GRID.desktop);
  const row = compact ? THUNDER_ROW_COMPACT_REM : THUNDER_ROW_REM;
  const gap = compact ? THUNDER_GAP_COMPACT_REM : THUNDER_GAP_REM;
  const minH = p.h * row + Math.max(0, p.h - 1) * gap;
  return {
    "--tc-gc": `${p.x + 1} / span ${p.w}`,
    "--tc-gr": `${p.y + 1} / span ${p.h}`,
    minHeight: `${minH}rem`,
  };
}

/** @deprecated use thunderGridItemStyle */
export function thunderGridCssVars(
  pos: WidgetGridPosition,
): Record<string, string> {
  return thunderGridItemStyle(pos, false);
}

/** Sort key: row-major (y then x), then order. */
export function thunderLayoutSortKey(w: {
  position: WidgetGridPosition;
  order: number;
}): number {
  return w.position.y * 1000 + w.position.x * 10 + w.order;
}

/** Axis-aligned overlap on the 12-col grid. */
export function rectsOverlap(
  a: WidgetGridPosition,
  b: WidgetGridPosition,
): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/**
 * Push widgets down until no two visible widgets overlap.
 * If `anchorId` is set, that widget stays fixed and others move.
 */
export function resolveWidgetOverlaps<
  T extends {
    id: string;
    position: WidgetGridPosition;
    visibility?: boolean;
    order: number;
  },
>(widgets: T[], anchorId?: string): T[] {
  const visible = widgets.filter((w) => w.visibility !== false);
  const placed: T[] = [];

  const anchor = anchorId
    ? visible.find((w) => w.id === anchorId)
    : undefined;
  if (anchor) {
    placed.push({
      ...anchor,
      position: clampPosition(anchor.position, GRID.desktop),
    });
  }

  const rest = visible
    .filter((w) => w.id !== anchorId)
    .sort((a, b) => thunderLayoutSortKey(a) - thunderLayoutSortKey(b));

  for (const raw of rest) {
    let pos = clampPosition(raw.position, GRID.desktop);
    let guard = 0;
    while (guard < 64) {
      const hit = placed.find((p) => rectsOverlap(pos, p.position));
      if (!hit) break;
      pos = clampPosition(
        {
          ...pos,
          y: hit.position.y + Math.max(1, hit.position.h),
        },
        GRID.desktop,
      );
      guard += 1;
    }
    placed.push({ ...raw, position: pos });
  }

  const byId = new Map(placed.map((w) => [w.id, w]));
  return widgets.map((w) => {
    if (w.visibility === false) return w;
    return byId.get(w.id) ?? w;
  });
}

/** Next free row below the lowest widget bottom edge. */
export function nextFreeRow(
  widgets: { position: WidgetGridPosition; visibility?: boolean }[],
): number {
  let maxBottom = 0;
  for (const w of widgets) {
    if (w.visibility === false) continue;
    maxBottom = Math.max(maxBottom, w.position.y + Math.max(1, w.position.h));
  }
  return maxBottom;
}

/** Bounding rows for edit-mode drop cells (content + padding). */
export function layoutRowCount(
  widgets: { position: WidgetGridPosition; visibility?: boolean }[],
  pad = 2,
): number {
  return Math.max(4, nextFreeRow(widgets) + pad);
}

/**
 * Pack visible widgets left→right, top→bottom (no holes).
 * Preserves each widget's w/h; reassigns x/y only.
 */
export function densifyWidgetLayout<
  T extends {
    id: string;
    position: WidgetGridPosition;
    visibility?: boolean;
    order: number;
  },
>(widgets: T[]): T[] {
  const visible = widgets
    .filter((w) => w.visibility !== false)
    .sort((a, b) => thunderLayoutSortKey(a) - thunderLayoutSortKey(b));

  const placed: T[] = [];
  for (const raw of visible) {
    const size = clampPosition(raw.position, GRID.desktop);
    let found: WidgetGridPosition | null = null;
    outer: for (let y = 0; y < 256; y += 1) {
      for (let x = 0; x <= GRID.desktop - size.w; x += 1) {
        const candidate = clampPosition(
          { x, y, w: size.w, h: size.h },
          GRID.desktop,
        );
        if (!placed.some((p) => rectsOverlap(candidate, p.position))) {
          found = candidate;
          break outer;
        }
      }
    }
    placed.push({
      ...raw,
      position: found ?? { x: 0, y: nextFreeRow(placed), w: size.w, h: size.h },
    });
  }

  const byId = new Map(placed.map((w) => [w.id, w]));
  return widgets.map((w) => {
    if (w.visibility === false) return w;
    return byId.get(w.id) ?? w;
  });
}

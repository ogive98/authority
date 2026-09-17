import type { WidgetGridPosition, WidgetSizeUnit } from "./types";

export const GRID = {
  desktop: 12,
  tablet: 8,
  mobile: 4,
} as const;

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
  const w = Math.min(pos.w, columns);
  const x = Math.max(0, Math.min(pos.x, columns - w));
  return { ...pos, x, w };
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

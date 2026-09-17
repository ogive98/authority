"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  clampPosition,
  densifyWidgetLayout,
  GRID,
  nextFreeRow,
  resolveWidgetOverlaps,
  type WidgetInstance,
} from "@/lib/dashboard-engine";
import {
  DEFAULT_THUNDER_ALERT_THRESHOLDS,
  type ThunderAlertThresholds,
} from "@/lib/thunder/alert-thresholds";
import {
  THUNDER_COMMAND_CENTER,
  THUNDER_WIDGET_DEFINITIONS,
} from "@/lib/thunder/command-center-catalog";

type ThunderDashboardState = {
  widgets: WidgetInstance[];
  editMode: boolean;
  compact: boolean;
  liveMode: boolean;
  thresholds: ThunderAlertThresholds;
  setEditMode: (v: boolean) => void;
  setCompact: (v: boolean) => void;
  setLiveMode: (v: boolean) => void;
  setThresholds: (partial: Partial<ThunderAlertThresholds>) => void;
  updateWidget: (id: string, patch: Partial<WidgetInstance>) => void;
  removeWidget: (id: string) => void;
  resetLayout: () => void;
  hideWidget: (id: string) => void;
  showWidget: (id: string) => void;
  /** Swap grid positions (free x/y) + keep order in sync. */
  swapWidgetPositions: (fromId: string, toId: string) => void;
  /** @deprecated alias — prefer swapWidgetPositions */
  reorderWidgets: (fromId: string, toId: string) => void;
  nudgeWidget: (id: string, dx: number, dy: number) => void;
  resizeWidget: (
    id: string,
    patch: Partial<{ w: number; h: number }>,
  ) => void;
  /** Place widget at grid cell (keeps w/h); others reflow around it. */
  placeWidgetAt: (id: string, x: number, y: number) => void;
  /** Pack left→right / top→bottom — remove holes. */
  densifyLayout: () => void;
  /** Replace local layout from server payload (keeps local if empty). */
  applyServerLayout: (payload: {
    widgets: WidgetInstance[];
    compact?: boolean;
    thresholds?: Partial<ThunderAlertThresholds>;
  }) => void;
  addWidget: (definitionId: string) => string | null;
  duplicateWidget: (id: string) => string | null;
};

function nextOrder(widgets: WidgetInstance[]): number {
  return widgets.reduce((m, w) => Math.max(m, w.order), -1) + 1;
}

function makeInstance(
  definitionId: string,
  order: number,
  y = 0,
): WidgetInstance | null {
  const def = THUNDER_WIDGET_DEFINITIONS.find((d) => d.id === definitionId);
  if (!def) return null;
  const id = `i-${definitionId.replace(/\./g, "-")}-${Date.now().toString(36)}`;
  return {
    id,
    widgetDefinitionId: definitionId,
    dashboardId: THUNDER_COMMAND_CENTER.id,
    position: clampPosition(
      {
        x: 0,
        y,
        w: def.defaultSize.w,
        h: Math.max(2, def.defaultSize.h || 2),
      },
      GRID.desktop,
    ),
    configuration: {},
    visibility: true,
    order,
  };
}

function syncOrderFromPositions(widgets: WidgetInstance[]): WidgetInstance[] {
  return [...widgets]
    .sort(
      (a, b) =>
        a.position.y - b.position.y ||
        a.position.x - b.position.x ||
        a.order - b.order,
    )
    .map((w, i) => ({ ...w, order: i }));
}

function packLayout(
  widgets: WidgetInstance[],
  anchorId?: string,
): WidgetInstance[] {
  return syncOrderFromPositions(resolveWidgetOverlaps(widgets, anchorId));
}

/** Repair persisted/corrupt sizes that collapse tiles. */
function sanitizeWidgets(widgets: WidgetInstance[]): WidgetInstance[] {
  return widgets.map((w) => ({
    ...w,
    position: clampPosition(
      {
        ...w.position,
        h: Math.max(2, w.position.h || 2),
        w: Math.max(3, w.position.w || 4),
      },
      GRID.desktop,
    ),
  }));
}

export const useThunderDashboardStore = create<ThunderDashboardState>()(
  persist(
    (set, get) => ({
      widgets: sanitizeWidgets(
        THUNDER_COMMAND_CENTER.widgets.map((w) => ({ ...w })),
      ),
      editMode: false,
      compact: false,
      liveMode: true,
      thresholds: { ...DEFAULT_THUNDER_ALERT_THRESHOLDS },
      setEditMode: (editMode) => set({ editMode }),
      setCompact: (compact) => set({ compact }),
      setLiveMode: (liveMode) => set({ liveMode }),
      setThresholds: (partial) =>
        set((s) => ({ thresholds: { ...s.thresholds, ...partial } })),
      updateWidget: (id, patch) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, ...patch } : w,
          ),
        })),
      removeWidget: (id) =>
        set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      hideWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, visibility: false } : w,
          ),
        })),
      showWidget: (id) =>
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === id ? { ...w, visibility: true } : w,
          ),
        })),
      swapWidgetPositions: (fromId, toId) => {
        if (fromId === toId) return;
        set((s) => {
          const from = s.widgets.find((w) => w.id === fromId);
          const to = s.widgets.find((w) => w.id === toId);
          if (!from || !to) return s;
          const next = s.widgets.map((w) => {
            if (w.id === fromId) return { ...w, position: { ...to.position } };
            if (w.id === toId) return { ...w, position: { ...from.position } };
            return w;
          });
          return { widgets: syncOrderFromPositions(sanitizeWidgets(next)) };
        });
      },
      reorderWidgets: (fromId, toId) => get().swapWidgetPositions(fromId, toId),
      nudgeWidget: (id, dx, dy) =>
        set((s) => {
          const next = s.widgets.map((w) => {
            if (w.id !== id) return w;
            return {
              ...w,
              position: clampPosition(
                {
                  ...w.position,
                  x: w.position.x + dx,
                  y: Math.max(0, w.position.y + dy),
                },
                GRID.desktop,
              ),
            };
          });
          return { widgets: packLayout(sanitizeWidgets(next), id) };
        }),
      resizeWidget: (id, patch) =>
        set((s) => {
          const defId = s.widgets.find((w) => w.id === id)?.widgetDefinitionId;
          const def = THUNDER_WIDGET_DEFINITIONS.find((d) => d.id === defId);
          const minW = def?.minSize.w ?? 3;
          const maxW = def?.maxSize.w ?? 12;
          const minH = Math.max(2, def?.minSize.h ?? 2);
          const maxH = def?.maxSize.h ?? 5;
          const next = s.widgets.map((w) => {
            if (w.id !== id) return w;
            const wSpan =
              patch.w != null
                ? Math.min(maxW, Math.max(minW, patch.w))
                : w.position.w;
            const hSpan =
              patch.h != null
                ? Math.min(maxH, Math.max(minH, patch.h))
                : w.position.h;
            return {
              ...w,
              position: clampPosition(
                { ...w.position, w: wSpan, h: hSpan },
                GRID.desktop,
              ),
            };
          });
          return { widgets: packLayout(sanitizeWidgets(next), id) };
        }),
      placeWidgetAt: (id, x, y) =>
        set((s) => {
          const next = s.widgets.map((w) => {
            if (w.id !== id) return w;
            return {
              ...w,
              position: clampPosition(
                { ...w.position, x, y },
                GRID.desktop,
              ),
            };
          });
          return { widgets: packLayout(sanitizeWidgets(next), id) };
        }),
      densifyLayout: () =>
        set((s) => ({
          widgets: syncOrderFromPositions(
            densifyWidgetLayout(sanitizeWidgets(s.widgets)),
          ),
        })),
      applyServerLayout: (payload) =>
        set((s) => ({
          widgets: sanitizeWidgets(
            payload.widgets.map((w) => ({
              ...w,
              dashboardId: THUNDER_COMMAND_CENTER.id,
              configuration: w.configuration ?? {},
            })),
          ),
          compact: payload.compact ?? s.compact,
          thresholds: payload.thresholds
            ? { ...s.thresholds, ...payload.thresholds }
            : s.thresholds,
        })),
      addWidget: (definitionId) => {
        const y = nextFreeRow(get().widgets);
        const inst = makeInstance(
          definitionId,
          nextOrder(get().widgets),
          y,
        );
        if (!inst) return null;
        set((s) => ({
          widgets: packLayout(sanitizeWidgets([...s.widgets, inst]), inst.id),
        }));
        return inst.id;
      },
      duplicateWidget: (id) => {
        const src = get().widgets.find((w) => w.id === id);
        if (!src) return null;
        const y = nextFreeRow(get().widgets);
        const inst = makeInstance(
          src.widgetDefinitionId,
          nextOrder(get().widgets),
          y,
        );
        if (!inst) return null;
        inst.position = clampPosition(
          { ...src.position, y, h: Math.max(2, src.position.h) },
          GRID.desktop,
        );
        inst.configuration = { ...src.configuration };
        set((s) => ({
          widgets: packLayout(sanitizeWidgets([...s.widgets, inst]), inst.id),
        }));
        return inst.id;
      },
      resetLayout: () =>
        set({
          widgets: sanitizeWidgets(
            THUNDER_COMMAND_CENTER.widgets.map((w) => ({ ...w })),
          ),
        }),
    }),
    {
      name: "authority-thunder-dashboard",
      merge: (persisted, current) => {
        const p = persisted as Partial<ThunderDashboardState> | undefined;
        return {
          ...current,
          ...p,
          widgets: sanitizeWidgets(
            p?.widgets?.length
              ? p.widgets
              : current.widgets,
          ),
        };
      },
    },
  ),
);

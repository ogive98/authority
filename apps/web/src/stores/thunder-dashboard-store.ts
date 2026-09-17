"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetInstance } from "@/lib/dashboard-engine";
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
  reorderWidgets: (fromId: string, toId: string) => void;
  addWidget: (definitionId: string) => string | null;
  duplicateWidget: (id: string) => string | null;
};

function nextOrder(widgets: WidgetInstance[]): number {
  return widgets.reduce((m, w) => Math.max(m, w.order), -1) + 1;
}

function makeInstance(definitionId: string, order: number): WidgetInstance | null {
  const def = THUNDER_WIDGET_DEFINITIONS.find((d) => d.id === definitionId);
  if (!def) return null;
  const id = `i-${definitionId.replace(/\./g, "-")}-${Date.now().toString(36)}`;
  return {
    id,
    widgetDefinitionId: definitionId,
    dashboardId: THUNDER_COMMAND_CENTER.id,
    position: {
      x: 0,
      y: 0,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
    },
    configuration: {},
    visibility: true,
    order,
  };
}

export const useThunderDashboardStore = create<ThunderDashboardState>()(
  persist(
    (set, get) => ({
      widgets: THUNDER_COMMAND_CENTER.widgets.map((w) => ({ ...w })),
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
      reorderWidgets: (fromId, toId) => {
        if (fromId === toId) return;
        set((s) => {
          const sorted = [...s.widgets].sort((a, b) => a.order - b.order);
          const fromIdx = sorted.findIndex((w) => w.id === fromId);
          const toIdx = sorted.findIndex((w) => w.id === toId);
          if (fromIdx < 0 || toIdx < 0) return s;
          const [moved] = sorted.splice(fromIdx, 1);
          sorted.splice(toIdx, 0, moved);
          return {
            widgets: sorted.map((w, i) => ({ ...w, order: i })),
          };
        });
      },
      addWidget: (definitionId) => {
        const inst = makeInstance(definitionId, nextOrder(get().widgets));
        if (!inst) return null;
        set((s) => ({ widgets: [...s.widgets, inst] }));
        return inst.id;
      },
      duplicateWidget: (id) => {
        const src = get().widgets.find((w) => w.id === id);
        if (!src) return null;
        const inst = makeInstance(
          src.widgetDefinitionId,
          nextOrder(get().widgets),
        );
        if (!inst) return null;
        inst.position = { ...src.position };
        inst.configuration = { ...src.configuration };
        set((s) => ({ widgets: [...s.widgets, inst] }));
        return inst.id;
      },
      resetLayout: () =>
        set({
          widgets: THUNDER_COMMAND_CENTER.widgets.map((w) => ({ ...w })),
        }),
    }),
    { name: "authority-thunder-dashboard" },
  ),
);

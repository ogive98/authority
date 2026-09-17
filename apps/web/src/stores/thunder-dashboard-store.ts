"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WidgetInstance } from "@/lib/dashboard-engine";
import {
  DEFAULT_THUNDER_ALERT_THRESHOLDS,
  type ThunderAlertThresholds,
} from "@/lib/thunder/alert-thresholds";
import { THUNDER_COMMAND_CENTER } from "@/lib/thunder/command-center-catalog";

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
};

export const useThunderDashboardStore = create<ThunderDashboardState>()(
  persist(
    (set) => ({
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
      resetLayout: () =>
        set({
          widgets: THUNDER_COMMAND_CENTER.widgets.map((w) => ({ ...w })),
        }),
    }),
    { name: "authority-thunder-dashboard" },
  ),
);

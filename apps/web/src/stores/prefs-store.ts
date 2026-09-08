"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact";

type PrefsState = {
  density: Density;
  /** Show offline SSE banner when stream is disconnected. */
  showSseBanner: boolean;
  /** Include Thunder/job alerts in the activity center filter (client UX). */
  jobAlerts: boolean;
  /**
   * Auto-collapse Finder sidebar after N seconds without hover.
   * `0` = disabled (manual only). Default 10.
   */
  sidebarAutoCollapseSec: number;
  setDensity: (d: Density) => void;
  setShowSseBanner: (v: boolean) => void;
  setJobAlerts: (v: boolean) => void;
  setSidebarAutoCollapseSec: (sec: number) => void;
  applyDensityToDom: (d: Density) => void;
};

function writeDensityAttr(d: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", d);
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      density: "comfortable",
      showSseBanner: true,
      jobAlerts: true,
      sidebarAutoCollapseSec: 10,
      setDensity: (density) => {
        writeDensityAttr(density);
        set({ density });
      },
      setShowSseBanner: (showSseBanner) => set({ showSseBanner }),
      setJobAlerts: (jobAlerts) => set({ jobAlerts }),
      setSidebarAutoCollapseSec: (sidebarAutoCollapseSec) =>
        set({
          sidebarAutoCollapseSec: Math.max(
            0,
            Math.min(120, Math.round(sidebarAutoCollapseSec)),
          ),
        }),
      applyDensityToDom: writeDensityAttr,
    }),
    {
      name: "authority-prefs",
      onRehydrateStorage: () => (state) => {
        if (state?.density) writeDensityAttr(state.density);
      },
    },
  ),
);

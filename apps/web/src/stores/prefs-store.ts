"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Density = "comfortable" | "compact" | "spacious";
export type SurfaceMode = "patch" | "ghost" | "solid" | "minimal";

type PrefsState = {
  density: Density;
  surfaceMode: SurfaceMode;
  /** Show offline SSE banner when stream is disconnected. */
  showSseBanner: boolean;
  /** Include Thunder/job alerts in the activity center filter (client UX). */
  jobAlerts: boolean;
  /**
   * Auto-collapse Finder sidebar after N seconds without hover.
   * `0` = disabled (manual only). Default 10.
   */
  sidebarAutoCollapseSec: number;
  /**
   * Calculator unlock code to exit SPECTRE / PATCH / GHOST (D162/D170).
   * Company setting `ops.unlock_code` is source of truth; localStorage is cache.
   * Default 3141 until hydrate.
   */
  opsUnlockCode: string;
  setDensity: (d: Density) => void;
  setSurfaceMode: (m: SurfaceMode) => void;
  setShowSseBanner: (v: boolean) => void;
  setJobAlerts: (v: boolean) => void;
  setSidebarAutoCollapseSec: (sec: number) => void;
  setOpsUnlockCode: (code: string) => void;
  applyDensityToDom: (d: Density) => void;
  applySurfaceToDom: (m: SurfaceMode) => void;
};

function writeDensityAttr(d: Density) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-density", d);
}

function writeSurfaceAttr(m: SurfaceMode) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-surface", m);
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      density: "comfortable",
      surfaceMode: "ghost",
      showSseBanner: true,
      jobAlerts: true,
      sidebarAutoCollapseSec: 10,
      opsUnlockCode: "3141",
      setDensity: (density) => {
        writeDensityAttr(density);
        set({ density });
      },
      setSurfaceMode: (surfaceMode) => {
        writeSurfaceAttr(surfaceMode);
        set({ surfaceMode });
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
      setOpsUnlockCode: (opsUnlockCode) => {
        const cleaned = opsUnlockCode.replace(/\D/g, "").slice(0, 12);
        if (cleaned.length < 4) return;
        set({ opsUnlockCode: cleaned });
      },
      applyDensityToDom: writeDensityAttr,
      applySurfaceToDom: writeSurfaceAttr,
    }),
    {
      name: "authority-prefs",
      onRehydrateStorage: () => (state) => {
        if (state?.density) writeDensityAttr(state.density);
        if (state?.surfaceMode) writeSurfaceAttr(state.surfaceMode);
      },
    },
  ),
);

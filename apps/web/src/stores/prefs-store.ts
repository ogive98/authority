"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  OPS_VISIBILITY_DEFAULTS,
  type OpsVisibilityPrefs,
} from "@/lib/ops-visibility";
import {
  defaultMutedMap,
  mergeMutedMap,
  type NotifMutedMap,
  type NotifSoundVariant,
  type NotifSourceKey,
} from "@/lib/notification-prefs";

export type Density = "comfortable" | "compact" | "spacious";
export type SurfaceMode = "patch" | "ghost" | "solid" | "minimal";

type PrefsState = {
  density: Density;
  surfaceMode: SurfaceMode;
  showSseBanner: boolean;
  jobAlerts: boolean;
  sidebarAutoCollapseSec: number;
  opsUnlockCode: string;
  opsVisibility: OpsVisibilityPrefs;
  /** D249 — mute per source (hidden + no sound). */
  notifMuted: NotifMutedMap;
  notifSoundEnabled: boolean;
  notifSoundVolume: number;
  notifSoundVariant: NotifSoundVariant;
  notifAnimEnabled: boolean;
  setDensity: (d: Density) => void;
  setSurfaceMode: (m: SurfaceMode) => void;
  setShowSseBanner: (v: boolean) => void;
  setJobAlerts: (v: boolean) => void;
  setSidebarAutoCollapseSec: (sec: number) => void;
  setOpsUnlockCode: (code: string) => void;
  setOpsVisibility: (v: Partial<OpsVisibilityPrefs>) => void;
  setNotifMuted: (source: NotifSourceKey, muted: boolean) => void;
  setNotifMutedAll: (muted: boolean) => void;
  setNotifSoundEnabled: (v: boolean) => void;
  setNotifSoundVolume: (v: number) => void;
  setNotifSoundVariant: (v: NotifSoundVariant) => void;
  setNotifAnimEnabled: (v: boolean) => void;
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
      opsVisibility: { ...OPS_VISIBILITY_DEFAULTS },
      notifMuted: defaultMutedMap(),
      notifSoundEnabled: true,
      notifSoundVolume: 0.45,
      notifSoundVariant: "pulse",
      notifAnimEnabled: true,
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
      setOpsVisibility: (partial) =>
        set((s) => ({
          opsVisibility: { ...s.opsVisibility, ...partial },
        })),
      setNotifMuted: (source, muted) =>
        set((s) => ({
          notifMuted: { ...s.notifMuted, [source]: muted },
        })),
      setNotifMutedAll: (muted) =>
        set({
          notifMuted: Object.fromEntries(
            Object.keys(defaultMutedMap()).map((k) => [k, muted]),
          ) as NotifMutedMap,
        }),
      setNotifSoundEnabled: (notifSoundEnabled) => set({ notifSoundEnabled }),
      setNotifSoundVolume: (notifSoundVolume) =>
        set({
          notifSoundVolume: Math.max(0, Math.min(1, notifSoundVolume)),
        }),
      setNotifSoundVariant: (notifSoundVariant) => set({ notifSoundVariant }),
      setNotifAnimEnabled: (notifAnimEnabled) => set({ notifAnimEnabled }),
      applyDensityToDom: writeDensityAttr,
      applySurfaceToDom: writeSurfaceAttr,
    }),
    {
      name: "authority-prefs",
      onRehydrateStorage: () => (state) => {
        if (state?.density) writeDensityAttr(state.density);
        if (state?.surfaceMode) writeSurfaceAttr(state.surfaceMode);
        if (state?.opsVisibility) {
          state.opsVisibility = {
            ...OPS_VISIBILITY_DEFAULTS,
            ...state.opsVisibility,
          };
        }
        if (state) {
          state.notifMuted = mergeMutedMap(state.notifMuted);
          if (typeof state.notifSoundEnabled !== "boolean") {
            state.notifSoundEnabled = true;
          }
          if (typeof state.notifSoundVolume !== "number") {
            state.notifSoundVolume = 0.45;
          }
          if (
            state.notifSoundVariant !== "soft" &&
            state.notifSoundVariant !== "pulse" &&
            state.notifSoundVariant !== "chime"
          ) {
            state.notifSoundVariant = "pulse";
          }
          if (typeof state.notifAnimEnabled !== "boolean") {
            state.notifAnimEnabled = true;
          }
        }
      },
    },
  ),
);

"use client";

import { create } from "zustand";

export type ThunderCcPower = "off" | "booting" | "on";

type ThunderCcPowerState = {
  power: ThunderCcPower;
  progress: number;
  label: string;
  /** Start boot UI immediately (dock click) — sequence runs on /thunder. */
  requestBoot: () => void;
  setBootProgress: (progress: number, label: string) => void;
  markOn: () => void;
  shutdown: () => void;
};

export const useThunderCcPowerStore = create<ThunderCcPowerState>((set, get) => ({
  power: "off",
  progress: 0,
  label: "",
  requestBoot: () => {
    if (get().power === "on") return;
    set({ power: "booting", progress: 4, label: "Mise sous tension…" });
  },
  setBootProgress: (progress, label) =>
    set({
      power: "booting",
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      label,
    }),
  markOn: () => set({ power: "on", progress: 100, label: "Opérationnel" }),
  shutdown: () => set({ power: "off", progress: 0, label: "" }),
}));

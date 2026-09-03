"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShellState = {
  mobileNavOpen: boolean;
  selectedModuleId: string;
  spectreEnabled: boolean;
  patchEnabled: boolean;
  paletteOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  setSelectedModuleId: (id: string) => void;
  setSpectreEnabled: (v: boolean) => void;
  setPatchEnabled: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      mobileNavOpen: false,
      selectedModuleId: "home",
      spectreEnabled: false,
      patchEnabled: false,
      paletteOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setSelectedModuleId: (id) => set({ selectedModuleId: id }),
      setSpectreEnabled: (v) => set({ spectreEnabled: v }),
      setPatchEnabled: (v) => set({ patchEnabled: v }),
      setPaletteOpen: (v) => set({ paletteOpen: v }),
    }),
    {
      name: "authority-shell",
      partialize: (s) => ({
        selectedModuleId: s.selectedModuleId,
        spectreEnabled: s.spectreEnabled,
        patchEnabled: s.patchEnabled,
      }),
    },
  ),
);

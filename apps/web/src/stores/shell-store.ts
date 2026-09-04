"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type ShellState = {
  mobileNavOpen: boolean;
  selectedModuleId: string;
  /** Feature flyout — open on module click, never a permanent 2nd sidebar. */
  featureMenuOpen: boolean;
  spectreEnabled: boolean;
  patchEnabled: boolean;
  paletteOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  setSelectedModuleId: (id: string) => void;
  setFeatureMenuOpen: (v: boolean) => void;
  selectModule: (id: string) => void;
  setSpectreEnabled: (v: boolean) => void;
  setPatchEnabled: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set) => ({
      mobileNavOpen: false,
      selectedModuleId: "home",
      featureMenuOpen: false,
      spectreEnabled: false,
      patchEnabled: false,
      paletteOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setSelectedModuleId: (id) => set({ selectedModuleId: id }),
      setFeatureMenuOpen: (v) => set({ featureMenuOpen: v }),
      selectModule: (id) =>
        set((s) => ({
          selectedModuleId: id,
          // Toggle if same module; otherwise open features for the new module.
          featureMenuOpen:
            s.selectedModuleId === id ? !s.featureMenuOpen : true,
          mobileNavOpen: false,
        })),
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

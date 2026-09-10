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
  /** GHOST MODE — 3rd ops mode (D162); exit via calculator unlock code. */
  ghostEnabled: boolean;
  paletteOpen: boolean;
  dockCollapsed: boolean;
  dockMobileOpen: boolean;
  setMobileNavOpen: (v: boolean) => void;
  setSelectedModuleId: (id: string) => void;
  setFeatureMenuOpen: (v: boolean) => void;
  selectModule: (id: string) => void;
  /** Enter-only from chrome icons (cannot toggle off here). */
  enterSpectre: () => void;
  enterPatch: () => void;
  enterGhost: () => void;
  setSpectreEnabled: (v: boolean) => void;
  setPatchEnabled: (v: boolean) => void;
  setGhostEnabled: (v: boolean) => void;
  /** Clear all ops modes after valid calculator unlock. */
  clearOpsModes: () => void;
  anyOpsMode: () => boolean;
  setPaletteOpen: (v: boolean) => void;
  setDockCollapsed: (v: boolean) => void;
  setDockMobileOpen: (v: boolean) => void;
};

export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      mobileNavOpen: false,
      selectedModuleId: "home",
      featureMenuOpen: false,
      spectreEnabled: false,
      patchEnabled: false,
      ghostEnabled: false,
      paletteOpen: false,
      dockCollapsed: false,
      dockMobileOpen: false,
      setMobileNavOpen: (v) => set({ mobileNavOpen: v }),
      setSelectedModuleId: (id) => set({ selectedModuleId: id }),
      setFeatureMenuOpen: (v) => set({ featureMenuOpen: v }),
      selectModule: (id) =>
        set((s) => ({
          selectedModuleId: id,
          featureMenuOpen:
            s.selectedModuleId === id ? !s.featureMenuOpen : true,
          mobileNavOpen: false,
        })),
      enterSpectre: () => set({ spectreEnabled: true }),
      enterPatch: () => set({ patchEnabled: true }),
      enterGhost: () => set({ ghostEnabled: true }),
      setSpectreEnabled: (v) => set({ spectreEnabled: v }),
      setPatchEnabled: (v) => set({ patchEnabled: v }),
      setGhostEnabled: (v) => set({ ghostEnabled: v }),
      clearOpsModes: () =>
        set({
          spectreEnabled: false,
          patchEnabled: false,
          ghostEnabled: false,
        }),
      anyOpsMode: () => {
        const s = get();
        return s.spectreEnabled || s.patchEnabled || s.ghostEnabled;
      },
      setPaletteOpen: (v) => set({ paletteOpen: v }),
      setDockCollapsed: (v) => set({ dockCollapsed: v }),
      setDockMobileOpen: (v) => set({ dockMobileOpen: v }),
    }),
    {
      name: "authority-shell",
      partialize: (s) => ({
        selectedModuleId: s.selectedModuleId,
        spectreEnabled: s.spectreEnabled,
        patchEnabled: s.patchEnabled,
        ghostEnabled: s.ghostEnabled,
        dockCollapsed: s.dockCollapsed,
      }),
    },
  ),
);

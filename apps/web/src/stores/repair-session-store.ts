"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type RepairLogSource = "thunder" | "repair";

export type RepairLogLine = {
  id: string;
  at: string;
  source: RepairLogSource;
  text: string;
};

export type RepairLastAction = {
  intent: string;
  status: "idle" | "running" | "ok" | "error";
  detail?: string;
  at: string;
};

type RepairSessionState = {
  lines: RepairLogLine[];
  lastAction: RepairLastAction | null;
  push: (text: string, source?: RepairLogSource) => void;
  setLastAction: (action: RepairLastAction | null) => void;
  clear: () => void;
};

const MAX_LINES = 80;

function stamp(): string {
  return new Date().toISOString().slice(11, 19);
}

export const useRepairSessionStore = create<RepairSessionState>()(
  persist(
    (set) => ({
      lines: [],
      lastAction: null,
      push: (text, source = "repair") =>
        set((s) => ({
          lines: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              at: stamp(),
              source,
              text,
            },
            ...s.lines,
          ].slice(0, MAX_LINES),
        })),
      setLastAction: (lastAction) => set({ lastAction }),
      clear: () => set({ lines: [], lastAction: null }),
    }),
    { name: "authority-repair-session" },
  ),
);

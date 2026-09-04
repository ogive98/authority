"use client";

import { useEffect } from "react";
import { usePrefsStore } from "@/stores/prefs-store";

const LEGACY_DENSITY_KEY = "authority-density";

/** Apply persisted density + migrate legacy localStorage key once. */
export function PrefsHydrator() {
  useEffect(() => {
    const legacy = localStorage.getItem(LEGACY_DENSITY_KEY);
    if (legacy === "compact" || legacy === "comfortable") {
      usePrefsStore.getState().setDensity(legacy);
      localStorage.removeItem(LEGACY_DENSITY_KEY);
      return;
    }
    const { density, applyDensityToDom } = usePrefsStore.getState();
    applyDensityToDom(density);
  }, []);

  return null;
}

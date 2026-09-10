"use client";

import { useEffect } from "react";
import { usePrefsStore } from "@/stores/prefs-store";
import { useLocaleStore } from "@/stores/locale-store";

const LEGACY_DENSITY_KEY = "authority-density";

/** Apply persisted density + surface + locale. */
export function PrefsHydrator() {
  useEffect(() => {
    const legacy = localStorage.getItem(LEGACY_DENSITY_KEY);
    if (
      legacy === "compact" ||
      legacy === "comfortable" ||
      legacy === "spacious"
    ) {
      usePrefsStore.getState().setDensity(legacy);
      localStorage.removeItem(LEGACY_DENSITY_KEY);
    } else {
      const { density, applyDensityToDom } = usePrefsStore.getState();
      applyDensityToDom(density);
    }
    const { surfaceMode, applySurfaceToDom } = usePrefsStore.getState();
    applySurfaceToDom(surfaceMode);
    const { locale, applyLocaleToDom } = useLocaleStore.getState();
    applyLocaleToDom(locale);
  }, []);

  return null;
}

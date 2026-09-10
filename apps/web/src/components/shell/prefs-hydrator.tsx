"use client";

import { useEffect } from "react";
import { fetchEffectiveSettings } from "@/lib/settings";
import { usePrefsStore } from "@/stores/prefs-store";
import { useLocaleStore } from "@/stores/locale-store";

const LEGACY_DENSITY_KEY = "authority-density";
const OPS_UNLOCK_KEY = "ops.unlock_code";

/** Apply persisted density + surface + locale; hydrate ops unlock from company settings. */
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

    void (async () => {
      const res = await fetchEffectiveSettings();
      if (!res.ok) return;
      const row = res.data.settings.find((s) => s.key === OPS_UNLOCK_KEY);
      if (typeof row?.value === "string" && row.value.replace(/\D/g, "").length >= 4) {
        usePrefsStore.getState().setOpsUnlockCode(row.value);
      }
    })();
  }, []);

  return null;
}

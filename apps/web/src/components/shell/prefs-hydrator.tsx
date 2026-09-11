"use client";

import { useEffect } from "react";
import { fetchEffectiveSettings } from "@/lib/settings";
import {
  OPS_VISIBILITY_DEFAULTS,
  OPS_VISIBILITY_KEYS,
  parseHiddenFeatures,
  parsePatchDisplayRules,
  parsePatchIntensity,
  parsePatchPreset,
} from "@/lib/ops-visibility";
import { usePrefsStore, type Density } from "@/stores/prefs-store";
import { useLocaleStore } from "@/stores/locale-store";

const LEGACY_DENSITY_KEY = "authority-density";
const OPS_UNLOCK_KEY = "ops.unlock_code";

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

/** Apply density/surface; hydrate ops + chrome from effective (ROLE→USER, D203 12C). */
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
      const byKey = new Map(
        res.data.settings.map((s) => [s.key, s.value] as const),
      );
      const unlock = byKey.get(OPS_UNLOCK_KEY);
      if (
        typeof unlock === "string" &&
        unlock.replace(/\D/g, "").length >= 4
      ) {
        usePrefsStore.getState().setOpsUnlockCode(unlock);
      }

      const densityVal = byKey.get("ui.density");
      if (
        densityVal === "compact" ||
        densityVal === "comfortable" ||
        densityVal === "spacious"
      ) {
        usePrefsStore.getState().setDensity(densityVal as Density);
      }

      const cur = usePrefsStore.getState().opsVisibility;
      usePrefsStore.getState().setOpsVisibility({
        ...OPS_VISIBILITY_DEFAULTS,
        ghostHideDelivery: asBool(
          byKey.get(OPS_VISIBILITY_KEYS.ghostHideDelivery),
          cur.ghostHideDelivery,
        ),
        patchHideDelivery: asBool(
          byKey.get(OPS_VISIBILITY_KEYS.patchHideDelivery),
          cur.patchHideDelivery,
        ),
        patchAccountingPartial: asBool(
          byKey.get(OPS_VISIBILITY_KEYS.patchAccountingPartial),
          cur.patchAccountingPartial,
        ),
        ghostAccountingPartial: asBool(
          byKey.get(OPS_VISIBILITY_KEYS.ghostAccountingPartial),
          cur.ghostAccountingPartial,
        ),
        patchAccountingPreset: parsePatchPreset(
          byKey.get(OPS_VISIBILITY_KEYS.patchAccountingPreset),
        ),
        patchAccountingIntensity: parsePatchIntensity(
          byKey.get(OPS_VISIBILITY_KEYS.patchAccountingIntensity),
          cur.patchAccountingIntensity,
        ),
        patchDisplayRules: parsePatchDisplayRules(
          byKey.get(OPS_VISIBILITY_KEYS.patchDisplayRules),
        ),
        ghostHiddenFeatures: parseHiddenFeatures(
          byKey.get(OPS_VISIBILITY_KEYS.ghostHiddenFeatures),
        ),
      });
    })();
  }, []);

  return null;
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  UNAUTH_REGISTRY,
  fetchMeRegistry,
  type MeRegistry,
} from "@/lib/registry";
import { localizeRegistry } from "@/lib/i18n/registry-labels";
import { filterRegistryForOpsModes } from "@/lib/ops-visibility";
import { useLocaleStore } from "@/stores/locale-store";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";

export function useMeRegistry() {
  const locale = useLocaleStore((s) => s.locale);
  const ghostEnabled = useShellStore((s) => s.ghostEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const opsVisibility = usePrefsStore((s) => s.opsVisibility);

  const query = useQuery<MeRegistry>({
    queryKey: ["me-registry"],
    queryFn: fetchMeRegistry,
    /** Accueil until API returns — never flash a fake full rail (D294 Track E). */
    placeholderData: (previous) => previous ?? UNAUTH_REGISTRY,
    staleTime: 30_000,
  });

  const raw = query.data ?? UNAUTH_REGISTRY;
  const data = useMemo(() => {
    const localized = localizeRegistry(raw, locale);
    return filterRegistryForOpsModes(localized, {
      ghostEnabled,
      patchEnabled,
      prefs: opsVisibility,
    });
  }, [raw, locale, ghostEnabled, patchEnabled, opsVisibility]);

  const unfiltered = useMemo(
    () => localizeRegistry(raw, locale),
    [raw, locale],
  );

  return {
    ...query,
    /** Always defined — rail icons never depend on a failed fetch. Localized (D166). */
    data,
    /** Registry before GHOST/PATCH filter — for URL gates (D208). */
    unfiltered,
  };
}

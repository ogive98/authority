"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_REGISTRY,
  fetchMeRegistry,
  type MeRegistry,
} from "@/lib/registry";
import { localizeRegistry } from "@/lib/i18n/registry-labels";
import { useLocaleStore } from "@/stores/locale-store";

export function useMeRegistry() {
  const locale = useLocaleStore((s) => s.locale);
  const query = useQuery<MeRegistry>({
    queryKey: ["me-registry"],
    queryFn: fetchMeRegistry,
    placeholderData: FALLBACK_REGISTRY,
    staleTime: 30_000,
  });

  const raw = query.data ?? FALLBACK_REGISTRY;
  const data = useMemo(
    () => localizeRegistry(raw, locale),
    [raw, locale],
  );

  return {
    ...query,
    /** Always defined — rail icons never depend on a failed fetch. Localized (D166). */
    data,
  };
}

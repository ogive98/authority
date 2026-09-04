"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FALLBACK_REGISTRY,
  fetchMeRegistry,
  type MeRegistry,
} from "@/lib/registry";

export function useMeRegistry() {
  const query = useQuery<MeRegistry>({
    queryKey: ["me-registry"],
    queryFn: fetchMeRegistry,
    placeholderData: FALLBACK_REGISTRY,
    staleTime: 30_000,
  });

  return {
    ...query,
    /** Always defined — rail icons never depend on a failed fetch. */
    data: query.data ?? FALLBACK_REGISTRY,
  };
}

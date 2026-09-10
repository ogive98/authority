"use client";

import { useQuery } from "@tanstack/react-query";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { loadHomeKpiCards } from "@/lib/home-kpis";
import { useShellStore } from "@/stores/shell-store";

export function useHomeKpis() {
  const { data: registry } = useMeRegistry();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const keys = registry.modules.map((m) => m.key).sort().join(",");

  return useQuery({
    queryKey: ["home-kpis", keys, selectedModuleId],
    queryFn: () =>
      loadHomeKpiCards(
        new Set(registry.modules.map((m) => m.key)),
        selectedModuleId,
      ),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

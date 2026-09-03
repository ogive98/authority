"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";

export function SyncModuleFromRoute() {
  const pathname = usePathname();
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);
  const { data: registry } = useMeRegistry();

  useEffect(() => {
    const modules = registry?.modules ?? [];
    if (pathname.startsWith("/settings")) {
      if (modules.some((m) => m.key === "settings")) {
        setSelectedModuleId("settings");
      }
      return;
    }
    if (pathname.startsWith("/search") || pathname.startsWith("/m/platform")) {
      if (modules.some((m) => m.key === "platform")) {
        setSelectedModuleId("platform");
      }
      return;
    }
    if (pathname.startsWith("/m/")) {
      const key = pathname.split("/")[2];
      if (key && modules.some((m) => m.key === key)) {
        setSelectedModuleId(key);
        return;
      }
    }
    if (pathname === "/" || pathname === "") {
      setSelectedModuleId("home");
    }
  }, [pathname, registry, setSelectedModuleId]);

  return null;
}

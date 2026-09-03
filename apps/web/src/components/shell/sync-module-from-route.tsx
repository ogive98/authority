"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useShellStore } from "@/stores/shell-store";
import { SHELL_MODULES } from "./nav-stub";

/** Keep selected module aligned with the current route. */
export function SyncModuleFromRoute() {
  const pathname = usePathname();
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);

  useEffect(() => {
    if (pathname.startsWith("/settings")) {
      setSelectedModuleId("settings");
      return;
    }
    if (pathname === "/" || pathname === "") {
      setSelectedModuleId("home");
      return;
    }
    const hit = SHELL_MODULES.find((m) =>
      m.features.some(
        (f) => f.href !== "/" && pathname.startsWith(f.href.split("#")[0]),
      ),
    );
    if (hit) setSelectedModuleId(hit.id);
  }, [pathname, setSelectedModuleId]);

  return null;
}

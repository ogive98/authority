"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { longestMatchingFeature } from "@/lib/ops-route-block";
import { useShellStore } from "@/stores/shell-store";

/**
 * Keep rail selection in sync with the URL via registry feature hrefs (D294 Track E).
 * No hardcoded module pathname map — catalog/activation stay on `/me/registry`.
 */
export function SyncModuleFromRoute() {
  const pathname = usePathname() ?? "/";
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);
  const setFeatureMenuOpen = useShellStore((s) => s.setFeatureMenuOpen);
  const { unfiltered } = useMeRegistry();

  useEffect(() => {
    setFeatureMenuOpen(false);

    // Launchpad — sidebar owns selection so Mission Control shows that module’s apps.
    if (pathname === "/" || pathname === "") {
      return;
    }

    // Chrome routes outside module feature hrefs.
    if (pathname.startsWith("/help")) {
      return;
    }
    if (pathname.startsWith("/settings")) {
      if (unfiltered.modules.some((m) => m.key === "settings")) {
        setSelectedModuleId("settings");
      }
      return;
    }
    if (pathname.startsWith("/account") || pathname.startsWith("/users")) {
      if (unfiltered.modules.some((m) => m.key === "identity")) {
        setSelectedModuleId("identity");
      }
      return;
    }

    const search =
      typeof window !== "undefined" ? window.location.search : "";
    const hash =
      typeof window !== "undefined" ? window.location.hash : "";
    const match = longestMatchingFeature(unfiltered, {
      pathname,
      search,
      hash,
    });
    if (match) {
      setSelectedModuleId(match.moduleKey);
      return;
    }

    // `/m/:moduleKey/...` deep links when feature hrefs are sparse.
    if (pathname.startsWith("/m/")) {
      const key = pathname.split("/")[2];
      if (key && unfiltered.modules.some((m) => m.key === key)) {
        setSelectedModuleId(key);
      }
    }
  }, [pathname, unfiltered, setSelectedModuleId, setFeatureMenuOpen]);

  return null;
}

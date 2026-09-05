"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";

/**
 * Keep rail selection in sync with the URL.
 * Preview screens map to home until business modules own those routes.
 */
export function SyncModuleFromRoute() {
  const pathname = usePathname();
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);
  const setFeatureMenuOpen = useShellStore((s) => s.setFeatureMenuOpen);
  const { data: registry } = useMeRegistry();

  useEffect(() => {
    const modules = registry.modules;
    const has = (key: string) => modules.some((m) => m.key === key);

    if (pathname.startsWith("/settings")) {
      if (has("settings")) setSelectedModuleId("settings");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/customers")) {
      if (has("customers")) setSelectedModuleId("customers");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/products")) {
      if (has("products")) setSelectedModuleId("products");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/sales") || pathname.startsWith("/preview/commandes")) {
      if (has("sales")) setSelectedModuleId("sales");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/preview/lots") || pathname.startsWith("/inventory")) {
      if (has("inventory")) setSelectedModuleId("inventory");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/delivery")) {
      if (has("delivery")) setSelectedModuleId("delivery");
      else if (has("sales")) setSelectedModuleId("sales");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/finance")) {
      if (has("finance")) setSelectedModuleId("finance");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/search") || pathname.startsWith("/m/platform")) {
      if (has("platform")) setSelectedModuleId("platform");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/m/")) {
      const key = pathname.split("/")[2];
      if (key && has(key)) {
        setSelectedModuleId(key);
        setFeatureMenuOpen(false);
        return;
      }
    }
    // Shell preview + home — Accueil until sales owns /preview routes.
    if (
      pathname === "/" ||
      pathname === "" ||
      pathname.startsWith("/preview")
    ) {
      if (has("home")) setSelectedModuleId("home");
      setFeatureMenuOpen(false);
    }
  }, [pathname, registry, setSelectedModuleId, setFeatureMenuOpen]);

  return null;
}

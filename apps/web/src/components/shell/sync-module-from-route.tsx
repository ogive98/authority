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
    if (pathname.startsWith("/account") || pathname.startsWith("/users")) {
      if (has("identity")) setSelectedModuleId("identity");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/customers")) {
      if (has("customers")) setSelectedModuleId("customers");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/suppliers")) {
      if (has("suppliers")) setSelectedModuleId("suppliers");
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
    if (pathname.startsWith("/inventory") || pathname.startsWith("/preview/lots")) {
      if (has("inventory")) setSelectedModuleId("inventory");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/production")) {
      if (has("production")) setSelectedModuleId("production");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/tax")) {
      if (has("tax")) setSelectedModuleId("tax");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/hr")) {
      if (has("hr")) setSelectedModuleId("hr");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/delivery")) {
      if (has("delivery")) setSelectedModuleId("delivery");
      else if (has("sales")) setSelectedModuleId("sales");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/fleet")) {
      if (has("fleet")) setSelectedModuleId("fleet");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/maintenance")) {
      if (has("maintenance")) setSelectedModuleId("maintenance");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/finance")) {
      if (has("finance")) setSelectedModuleId("finance");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/accounting")) {
      if (has("accounting")) setSelectedModuleId("accounting");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/repair")) {
      if (has("repair")) setSelectedModuleId("repair");
      setFeatureMenuOpen(false);
      return;
    }
    if (pathname.startsWith("/documents")) {
      if (has("documents")) setSelectedModuleId("documents");
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
    // Launchpad `/` — do NOT force Accueil: sidebar sets the selected module
    // so the grid shows that module’s apps (Contiental D095).
    if (pathname === "/" || pathname === "") {
      setFeatureMenuOpen(false);
      return;
    }
    // Preview stubs until owned by sales.
    if (pathname.startsWith("/preview")) {
      if (has("home")) setSelectedModuleId("home");
      setFeatureMenuOpen(false);
    }
  }, [pathname, registry, setSelectedModuleId, setFeatureMenuOpen]);

  return null;
}

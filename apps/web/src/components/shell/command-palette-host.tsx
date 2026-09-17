"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ACommandPalette } from "@/components/a/a-command-palette";
import { matchShortcut } from "@/lib/command-catalog";
import { resolveActions } from "@/lib/action-registry";
import { useMeGrants } from "@/hooks/use-me-grants";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";
import { useLocaleStore } from "@/stores/locale-store";

/** Global Ctrl/Cmd+K + command shortcuts + palette host (Action Registry). */
export function CommandPaletteHost() {
  const open = useShellStore((s) => s.paletteOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const router = useRouter();
  const { data: registry } = useMeRegistry();
  const { grants } = useMeGrants();
  const locale = useLocaleStore((s) => s.locale);

  const allowed = useMemo(
    () =>
      resolveActions({
        registry,
        grants,
        context: "palette",
        locale,
      }),
    [registry, grants, locale],
  );

  const enabledModules = useMemo(
    () => new Set(registry.modules.map((m) => m.key)),
    [registry],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useShellStore.getState().paletteOpen);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      for (const item of allowed) {
        if (!item.shortcut || !matchShortcut(e, item.shortcut)) continue;
        e.preventDefault();
        if (item.id === "act-theme") {
          const cur =
            document.documentElement.getAttribute("data-theme") === "light"
              ? "light"
              : "dark";
          document.documentElement.setAttribute(
            "data-theme",
            cur === "dark" ? "light" : "dark",
          );
          return;
        }
        if (item.href) {
          router.push(item.href);
        }
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, router, allowed]);

  return (
    <ACommandPalette
      open={open}
      onOpenChange={setPaletteOpen}
      grants={grants}
      enabledModules={enabledModules}
    />
  );
}

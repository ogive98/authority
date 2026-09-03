"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ACommandPalette } from "@/components/a/a-command-palette";
import {
  COMMAND_CATALOG,
  DEMO_ENABLED_MODULES,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
  matchShortcut,
} from "@/lib/command-catalog";
import { useShellStore } from "@/stores/shell-store";

/** Global Ctrl/Cmd+K + command shortcuts + palette host. */
export function CommandPaletteHost() {
  const open = useShellStore((s) => s.paletteOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!useShellStore.getState().paletteOpen);
        return;
      }

      // Don't steal typing in inputs (except when palette open — handled inside)
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      const allowed = filterCommands(COMMAND_CATALOG, {
        query: "",
        grants: DEMO_PERMISSION_GRANTS,
        enabledModules: DEMO_ENABLED_MODULES,
      });

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
  }, [setPaletteOpen, router]);

  return <ACommandPalette open={open} onOpenChange={setPaletteOpen} />;
}

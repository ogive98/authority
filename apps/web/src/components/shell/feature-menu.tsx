"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";

/**
 * Compact feature popover on module click.
 * Never full-height — a tall panel was intercepting clicks across the page.
 */
export function FeatureMenu() {
  const pathname = usePathname();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const open = useShellStore((s) => s.featureMenuOpen);
  const setFeatureMenuOpen = useShellStore((s) => s.setFeatureMenuOpen);
  const { data: registry } = useMeRegistry();
  const mod = registry.modules.find((m) => m.key === selectedModuleId);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFeatureMenuOpen(false);
    }

    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if ((t as Element).closest?.("#shell-sidebar, #shell-sidebar-mobile")) {
        return;
      }
      setFeatureMenuOpen(false);
    }

    document.addEventListener("keydown", onKey);
    // Capture so we close before other handlers; still allow the click through after close.
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, setFeatureMenuOpen]);

  if (!open || !mod || mod.features.length === 0) {
    return null;
  }

  return (
    <aside
      ref={panelRef}
      className={cn(
        "fixed top-12 left-14 z-[var(--a-z-dropdown)] flex w-52 flex-col",
        "max-h-[min(20rem,calc(100vh-5rem))] overflow-hidden",
        "rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2",
        "shadow-[0_12px_32px_rgb(0_0_0_/_0.35)]",
      )}
      aria-label={`Fonctionnalités — ${mod.name}`}
    >
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-a-border-subtle px-3">
        <p className="truncate text-[length:var(--a-text-sm)] font-medium">
          {mod.name}
        </p>
        <button
          type="button"
          title="Fermer"
          aria-label="Fermer le menu fonctionnalités"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--a-radius-md)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
          onClick={() => setFeatureMenuOpen(false)}
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto p-1.5">
        <ul className="space-y-0.5">
          {mod.features.map((f) => {
            const pathOnly = f.href.split("#")[0] || "/";
            const active =
              pathOnly === "/"
                ? pathname === "/"
                : pathname === pathOnly ||
                  pathname.startsWith(pathOnly + "/");
            return (
              <li key={f.id}>
                <Link
                  href={f.href}
                  onClick={() => setFeatureMenuOpen(false)}
                  className={cn(
                    "block rounded-[var(--a-radius-md)] px-2.5 py-2 text-[length:var(--a-text-sm)] transition-colors",
                    active
                      ? "bg-a-surface-3 font-medium text-a-fg"
                      : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                  )}
                >
                  {f.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";

export function FeatureMenu() {
  const pathname = usePathname();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const mod = registry?.modules.find((m) => m.key === selectedModuleId);

  if (!mod || mod.features.length === 0) {
    return null;
  }

  return (
    <aside
      className="flex w-48 shrink-0 flex-col border-r border-a-border-subtle bg-a-surface-2"
      aria-label={`Fonctionnalités — ${mod.name}`}
    >
      <div className="flex h-12 items-center border-b border-a-border-subtle px-3">
        <p className="truncate text-[length:var(--a-text-sm)] font-medium">
          {mod.name}
        </p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
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

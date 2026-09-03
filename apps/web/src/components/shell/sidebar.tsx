"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useShellStore } from "@/stores/shell-store";
import { visibleModules } from "./nav-stub";

/**
 * Icon rail — collapsed by default; expands on hover (desktop).
 * Click module → features in FeatureMenu.
 */
export function ShellSidebar() {
  const [hovered, setHovered] = useState(false);
  const mobileOpen = useShellStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);

  const expanded = mobileOpen || hovered;
  const modules = visibleModules();

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[var(--a-z-dropdown)] bg-a-surface-1/60 md:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="shell-sidebar"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "group/rail fixed inset-y-0 left-0 z-[var(--a-z-sticky)] flex flex-col border-r border-a-border-subtle bg-a-surface-1",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          "md:static md:translate-x-0",
          expanded ? "w-[13.5rem]" : "w-14",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-12 shrink-0 items-center border-b border-a-border-subtle",
            expanded ? "gap-2.5 px-3" : "justify-center px-2",
          )}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-a-border-strong text-[length:var(--a-text-sm)] font-semibold"
            style={{ borderRadius: "var(--a-radius-sm)" }}
            aria-hidden
          >
            A
          </span>
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-opacity duration-200",
              expanded ? "opacity-100" : "w-0 opacity-0",
            )}
          >
            <p className="truncate text-[length:var(--a-text-sm)] font-semibold tracking-tight">
              AUTHORITY
            </p>
          </div>
        </div>

        <nav
          className="flex-1 overflow-x-hidden overflow-y-auto py-2"
          aria-label="Modules"
        >
          <ul className="space-y-0.5 px-1.5">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const active = selectedModuleId === mod.id;
              return (
                <li key={mod.id}>
                  <button
                    type="button"
                    title={mod.label}
                    onClick={() => {
                      setSelectedModuleId(mod.id);
                      setMobileNavOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[var(--a-radius-md)] py-2 text-left text-[length:var(--a-text-sm)] transition-colors",
                      expanded ? "px-2.5" : "justify-center px-0",
                      active
                        ? "bg-a-surface-3 text-a-fg"
                        : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                    )}
                  >
                    <Icon
                      className="h-[1.125rem] w-[1.125rem] shrink-0"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "truncate transition-opacity duration-200",
                        expanded ? "opacity-100" : "w-0 overflow-hidden opacity-0",
                      )}
                    >
                      {mod.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";
import { iconForModule } from "./module-icons";

/**
 * Module icon rail — width always w-14 (never steals clicks over main content).
 * Hover shows floating labels (pointer-events-none). Click opens feature popover.
 */
export function ShellSidebar() {
  const mobileOpen = useShellStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const featureMenuOpen = useShellStore((s) => s.featureMenuOpen);
  const selectModule = useShellStore((s) => s.selectModule);
  const { data: registry } = useMeRegistry();
  const modules = registry.modules;

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

      <div className="hidden w-14 shrink-0 md:block" aria-hidden />

      <aside
        id="shell-sidebar"
        className="fixed inset-y-0 left-0 z-[var(--a-z-sticky)] hidden w-14 flex-col border-r border-a-border-subtle bg-a-surface-1 md:flex"
      >
        <div className="flex h-12 shrink-0 items-center justify-center border-b border-a-border-subtle">
          <span
            className="flex h-8 w-8 items-center justify-center border border-a-border-strong text-[length:var(--a-text-sm)] font-semibold"
            style={{ borderRadius: "var(--a-radius-sm)" }}
            aria-hidden
          >
            A
          </span>
        </div>

        <nav
          className="flex-1 overflow-y-auto py-2"
          aria-label="Modules"
        >
          <ul className="space-y-0.5 px-1.5">
            {modules.map((mod) => {
              const Icon = iconForModule(mod.key);
              const active = selectedModuleId === mod.key;
              return (
                <li key={mod.key} className="relative">
                  <button
                    type="button"
                    id={`rail-${mod.key}`}
                    title={mod.name}
                    aria-label={mod.name}
                    aria-haspopup="dialog"
                    aria-expanded={featureMenuOpen && active}
                    aria-controls="shell-feature-menu"
                    onClick={() => selectModule(mod.key)}
                    className={cn(
                      "group/item relative flex w-full items-center justify-center rounded-[var(--a-radius-md)] py-2 transition-colors",
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
                    {/* Floating label — never widens hit-box over the workspace */}
                    <span
                      className={cn(
                        "pointer-events-none absolute top-1/2 left-[calc(100%+0.5rem)] z-[var(--a-z-dropdown)] -translate-y-1/2",
                        "whitespace-nowrap rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-2.5 py-1.5",
                        "text-[length:var(--a-text-sm)] text-a-fg",
                        "opacity-0 transition-opacity duration-100 group-hover/item:opacity-100",
                      )}
                    >
                      {mod.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <aside
        id="shell-sidebar-mobile"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-[var(--a-z-dropdown)] flex w-[13.5rem] flex-col border-r border-a-border-subtle bg-a-surface-1 md:hidden",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          mobileOpen
            ? "translate-x-0"
            : "pointer-events-none -translate-x-full",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-a-border-subtle px-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center border border-a-border-strong text-[length:var(--a-text-sm)] font-semibold"
            style={{ borderRadius: "var(--a-radius-sm)" }}
            aria-hidden
          >
            A
          </span>
          <p className="truncate text-[length:var(--a-text-sm)] font-semibold tracking-tight">
            AUTHORITY
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2" aria-label="Modules">
          <ul className="space-y-0.5 px-1.5">
            {modules.map((mod) => {
              const Icon = iconForModule(mod.key);
              const active = selectedModuleId === mod.key;
              return (
                <li key={mod.key}>
                  <button
                    type="button"
                    id={`rail-m-${mod.key}`}
                    title={mod.name}
                    aria-label={mod.name}
                    aria-haspopup="dialog"
                    aria-expanded={featureMenuOpen && active}
                    tabIndex={mobileOpen ? 0 : -1}
                    onClick={() => selectModule(mod.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[var(--a-radius-md)] px-2.5 py-2 text-left text-[length:var(--a-text-sm)] transition-colors",
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
                    <span className="truncate">{mod.name}</span>
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

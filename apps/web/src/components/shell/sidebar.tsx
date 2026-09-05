"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";
import { iconForModule } from "./module-icons";

const ICON = "h-4 w-4 shrink-0";
const STROKE = 1.5;
/** Single nav type scale — sober, no weight fights. */
const NAV =
  "text-[13px] font-normal leading-5 tracking-normal";

/**
 * Minimal sidebar — flat labels, thin icons, soft active only.
 */
export function ShellSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const mobileOpen = useShellStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);
  const { data: registry } = useMeRegistry();
  const modules = registry.modules;

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(modules.map((m) => [m.key, true])),
  );

  const widthClass = collapsed ? "w-[4.25rem]" : "w-[14.5rem]";
  const activeHref = useMemo(() => pathname, [pathname]);

  function pathActive(href: string) {
    const pathOnly = href.split("#")[0] || "/";
    if (pathOnly === "/") return activeHref === "/";
    return activeHref === pathOnly || activeHref.startsWith(pathOnly + "/");
  }

  function toggleSection(key: string) {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }

  function NavBody({ mobile = false }: { mobile?: boolean }) {
    const expanded = mobile || !collapsed;
    return (
      <>
        <div
          className={cn(
            "flex h-12 shrink-0 items-center",
            expanded ? "justify-between gap-2 px-3" : "justify-center px-2",
          )}
        >
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2"
            onClick={() => setMobileNavOpen(false)}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-a-accent text-[11px] font-medium text-a-accent-fg"
              aria-hidden
            >
              A
            </span>
            {expanded ? (
              <span className="truncate text-[13px] font-medium tracking-tight text-a-fg">
                AUTHORITY
              </span>
            ) : null}
          </Link>
          {!mobile ? (
            <button
              type="button"
              title={collapsed ? "Étendre" : "Réduire"}
              aria-label={
                collapsed ? "Étendre la navigation" : "Réduire la navigation"
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-a-fg-subtle hover:bg-a-surface-3 hover:text-a-fg"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? (
                <PanelLeft className="h-3.5 w-3.5" strokeWidth={STROKE} />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={STROKE} />
              )}
            </button>
          ) : null}
        </div>

        <nav
          className="flex-1 overflow-y-auto px-2 pb-2 pt-1"
          aria-label="Modules"
        >
          <ul className="space-y-px">
            {modules.map((mod) => {
              const Icon = iconForModule(mod.key);
              const sectionOpen = openSections[mod.key] !== false;
              const hasFeatures = mod.features.length > 0;
              const childActive = mod.features.some((f) => pathActive(f.href));

              return (
                <li key={mod.key}>
                  <button
                    type="button"
                    title={mod.name}
                    onClick={() => {
                      setSelectedModuleId(mod.key);
                      if (!expanded && mod.features[0]) {
                        router.push(mod.features[0].href);
                        setMobileNavOpen(false);
                        return;
                      }
                      if (hasFeatures) toggleSection(mod.key);
                      else if (mod.features[0]) {
                        router.push(mod.features[0].href);
                        setMobileNavOpen(false);
                      }
                    }}
                    className={cn(
                      NAV,
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors duration-100",
                      childActive
                        ? "bg-a-accent-muted text-a-accent"
                        : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                      !expanded && "justify-center px-0",
                    )}
                  >
                    <Icon
                      className={cn(
                        ICON,
                        childActive ? "text-a-accent" : "text-a-fg-subtle",
                      )}
                      strokeWidth={STROKE}
                      aria-hidden
                    />
                    {expanded ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">
                          {mod.name}
                        </span>
                        {hasFeatures ? (
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-a-fg-subtle transition-transform duration-150",
                              !sectionOpen && "-rotate-90",
                            )}
                            strokeWidth={STROKE}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </button>

                  {expanded && hasFeatures && sectionOpen ? (
                    <ul className="mb-1 mt-px space-y-px pl-9">
                      {mod.features.map((f) => {
                        const active = pathActive(f.href);
                        return (
                          <li key={f.id}>
                            <Link
                              href={f.href}
                              onClick={() => {
                                setSelectedModuleId(mod.key);
                                setMobileNavOpen(false);
                              }}
                              className={cn(
                                NAV,
                                "flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors duration-100",
                                active
                                  ? "text-a-accent"
                                  : "text-a-fg-muted hover:text-a-fg",
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1 w-1 shrink-0 rounded-full",
                                  active ? "bg-a-accent" : "bg-a-border-strong",
                                )}
                                aria-hidden
                              />
                              <span className="truncate">{f.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={cn(
            "shrink-0 space-y-px border-t border-a-border-subtle py-2",
            expanded ? "px-2" : "px-1",
          )}
        >
          <Link
            href="/settings"
            className={cn(
              NAV,
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
              !expanded && "justify-center px-0",
            )}
            title="Centre d’aide"
            onClick={() => setMobileNavOpen(false)}
          >
            <HelpCircle
              className={cn(ICON, "text-a-fg-subtle")}
              strokeWidth={STROKE}
            />
            {expanded ? <span>Aide</span> : null}
          </Link>
          <button
            type="button"
            title="Déconnexion (stub)"
            className={cn(
              NAV,
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
              !expanded && "justify-center px-0",
            )}
          >
            <LogOut
              className={cn(ICON, "text-a-fg-subtle")}
              strokeWidth={STROKE}
            />
            {expanded ? <span>Déconnexion</span> : null}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[var(--a-z-dropdown)] bg-a-fg/15 md:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="shell-sidebar"
        className={cn(
          "hidden shrink-0 flex-col border-r border-a-border-subtle bg-a-surface-2/90 backdrop-blur-md md:flex",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          widthClass,
        )}
      >
        <NavBody />
      </aside>

      <aside
        id="shell-sidebar-mobile"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-[var(--a-z-dropdown)] flex w-[14.5rem] flex-col border-r border-a-border-subtle bg-a-surface-2 md:hidden",
          "transition-transform duration-200 ease-out",
          mobileOpen
            ? "translate-x-0"
            : "pointer-events-none -translate-x-full",
        )}
      >
        <NavBody mobile />
      </aside>
    </>
  );
}

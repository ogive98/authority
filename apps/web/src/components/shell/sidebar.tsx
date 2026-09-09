"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  HelpCircle,
  LogOut,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUSINESS_LOGIN_PATH,
  logoutBusiness,
} from "@/lib/business-auth";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";
import { iconForModule } from "./module-icons";
import { personalityForModule } from "./icon-personality";

const STROKE = 1.35;

/**
 * Finder sidebar — modules only. Collapse lives here (does not affect topbar).
 * Auto-collapse after idle (prefs: sidebarAutoCollapseSec).
 */
export function ShellSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [railCollapsed, setRailCollapsed] = useState(false);
  const autoCollapseSec = usePrefsStore((s) => s.sidebarAutoCollapseSec);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);

  const mobileOpen = useShellStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const setSelectedModuleId = useShellStore((s) => s.setSelectedModuleId);
  const { data: registry } = useMeRegistry();
  const modules = registry.modules;

  const widthClass = railCollapsed
    ? "w-[5.25rem]"
    : "w-[var(--a-sidebar-width)]";

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleCollapse = useCallback(() => {
    clearTimer();
    if (autoCollapseSec <= 0) return;
    timerRef.current = setTimeout(() => {
      if (!hoveringRef.current) setRailCollapsed(true);
    }, autoCollapseSec * 1000);
  }, [autoCollapseSec, clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  // Idle collapse while expanded and not hovering (incl. first paint)
  useEffect(() => {
    if (railCollapsed || hoveringRef.current) return;
    scheduleCollapse();
  }, [autoCollapseSec, railCollapsed, scheduleCollapse]);

  function onSidebarEnter() {
    hoveringRef.current = true;
    clearTimer();
    if (railCollapsed && autoCollapseSec > 0) {
      setRailCollapsed(false);
    }
  }

  function onSidebarLeave() {
    hoveringRef.current = false;
    scheduleCollapse();
  }

  function toggleRail() {
    clearTimer();
    setRailCollapsed((c) => {
      const next = !c;
      if (!next && autoCollapseSec > 0 && !hoveringRef.current) {
        // Expanded via button — still auto-collapse if mouse is outside
        timerRef.current = setTimeout(() => {
          if (!hoveringRef.current) setRailCollapsed(true);
        }, autoCollapseSec * 1000);
      }
      return next;
    });
  }

  function activateModule(key: string) {
    setSelectedModuleId(key);
    setMobileNavOpen(false);
    if (pathname !== "/") router.push("/");
  }

  function NavBody({ mobile = false }: { mobile?: boolean }) {
    const expanded = mobile || !railCollapsed;
    return (
      <div className="flex h-full min-h-0 flex-col">
        {!mobile ? (
          <div
            className={cn(
              "flex h-10 shrink-0 items-center px-2",
              expanded ? "justify-end" : "justify-center",
            )}
          >
            <button
              type="button"
              title={railCollapsed ? "Étendre" : "Réduire"}
              aria-label={
                railCollapsed
                  ? "Étendre la navigation"
                  : "Réduire la navigation"
              }
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-a-fg-subtle hover:bg-a-surface-3 hover:text-a-fg"
              onClick={toggleRail}
            >
              {railCollapsed ? (
                <PanelLeft className="h-3.5 w-3.5" strokeWidth={STROKE} />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={STROKE} />
              )}
            </button>
          </div>
        ) : (
          <div className="h-3 shrink-0" />
        )}

        <nav
          className="a-ios-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-2 pt-0.5"
          aria-label="Modules"
        >
          <ul className="space-y-0.5">
            {modules.map((mod) => {
              const Icon = iconForModule(mod.key);
              const personality = personalityForModule(mod.key);
              const on = selectedModuleId === mod.key;

              return (
                <li key={mod.key}>
                  <button
                    type="button"
                    title={mod.name}
                    className={cn(
                      "a-nav-row group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors",
                      `a-motion-${personality.motion}`,
                      on ? "bg-a-accent/12" : "hover:bg-white/40",
                      !expanded && "justify-center px-1",
                    )}
                    onClick={() => activateModule(mod.key)}
                  >
                    <span
                      className={cn(
                        "a-app-icon a-nav-icon relative inline-flex shrink-0 items-center justify-center",
                        personality.colorClass,
                      )}
                    >
                      {personality.motion === "smoke" ? (
                        <span className="a-fx-smoke" aria-hidden>
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : null}
                      <Icon
                        className="a-app-glyph h-6 w-6"
                        strokeWidth={STROKE}
                        aria-hidden
                      />
                    </span>
                    {expanded ? (
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[14px] tracking-[-0.015em]",
                          on
                            ? "font-semibold text-a-fg"
                            : "font-medium text-a-fg-muted",
                        )}
                      >
                        {mod.name}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={cn(
            "shrink-0 space-y-0.5 pb-2",
            expanded ? "px-2" : "px-1.5",
          )}
        >
          <Link
            href="/help"
            className={cn(
              "group flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-a-fg-muted hover:bg-white/40 hover:text-a-fg",
              !expanded && "justify-center",
            )}
            title="Centre d’aide"
            onClick={() => setMobileNavOpen(false)}
          >
            <HelpCircle
              className="a-app-glyph h-5 w-5 text-a-fg-subtle"
              strokeWidth={STROKE}
            />
            {expanded ? (
              <span className="text-[13px] font-medium">Aide</span>
            ) : null}
          </Link>
          <button
            type="button"
            title="Déconnexion"
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-a-fg-muted hover:bg-white/40 hover:text-a-fg",
              !expanded && "justify-center",
            )}
            onClick={() => {
              setMobileNavOpen(false);
              void (async () => {
                await logoutBusiness();
                router.replace(BUSINESS_LOGIN_PATH);
                router.refresh();
              })();
            }}
          >
            <LogOut
              className="a-app-glyph h-5 w-5 text-a-orange"
              strokeWidth={STROKE}
            />
            {expanded ? (
              <span className="text-[13px] font-medium">Déconnexion</span>
            ) : null}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-[var(--a-z-dropdown)] bg-black/20 backdrop-blur-[2px] md:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <aside
        id="shell-sidebar"
        className={cn(
          "a-glass hidden h-full min-h-0 shrink-0 flex-col md:flex",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          widthClass,
        )}
        onMouseEnter={onSidebarEnter}
        onMouseLeave={onSidebarLeave}
      >
        <NavBody />
      </aside>

      <aside
        id="shell-sidebar-mobile"
        aria-hidden={!mobileOpen}
        className={cn(
          "a-glass-strong fixed inset-y-0 left-0 z-[var(--a-z-dropdown)] flex w-[var(--a-sidebar-width)] flex-col md:hidden",
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HelpCircle,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Settings2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUSINESS_LOGIN_PATH,
  logoutBusiness,
} from "@/lib/business-auth";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";
import { useShellT } from "@/stores/locale-store";
import { iconForModule } from "./module-icons";
import type { RegistryModule } from "@/lib/registry";

const STROKE = 1.5;
/** Modules that belong under « Système », not the business rail. */
const SYSTEM_MODULE_KEYS = new Set(["repair", "settings"]);

/**
 * Finder sidebar — Modules + Système, icônes orange plus grandes.
 */
export function ShellSidebar() {
  const { t } = useShellT();
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

  const { businessModules, systemFromRegistry } = useMemo(() => {
    const business: RegistryModule[] = [];
    const system: RegistryModule[] = [];
    for (const mod of registry.modules) {
      if (SYSTEM_MODULE_KEYS.has(mod.key)) system.push(mod);
      else business.push(mod);
    }
    return { businessModules: business, systemFromRegistry: system };
  }, [registry.modules]);

  const widthClass = railCollapsed
    ? "w-[4.75rem]"
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

  function SectionLabel({
    children,
    expanded,
  }: {
    children: string;
    expanded: boolean;
  }) {
    if (!expanded) return null;
    return (
      <p className="px-2 pb-0.5 pt-1.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-a-fg-subtle">
        {children}
      </p>
    );
  }

  function ModuleRow({
    mod,
    expanded,
  }: {
    mod: RegistryModule;
    expanded: boolean;
  }) {
    const Icon = iconForModule(mod.key);
    const on = selectedModuleId === mod.key;
    return (
      <li>
        <button
          type="button"
          title={mod.name}
          className={cn(
            "a-nav-row group flex w-full items-center gap-2.5 rounded-[var(--a-radius-sm)] px-1.5 py-1.5 text-left",
            on && "is-active",
            !expanded && "justify-center px-0.5",
          )}
          aria-current={on ? "true" : undefined}
          onClick={() => activateModule(mod.key)}
        >
          <Icon
            className={cn(
              "h-5 w-5 shrink-0 text-a-orange",
              on && "text-a-orange",
            )}
            strokeWidth={STROKE}
            aria-hidden
          />
          {expanded ? (
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[12.5px] tracking-[-0.015em]",
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
  }

  function SystemLink({
    href,
    label,
    icon: Icon,
    expanded,
    onClick,
  }: {
    href?: string;
    label: string;
    icon: typeof HelpCircle;
    expanded: boolean;
    onClick?: () => void;
  }) {
    const className = cn(
      "a-nav-row group flex w-full items-center gap-2.5 rounded-[var(--a-radius-sm)] px-1.5 py-1.5 text-a-fg-muted",
      !expanded && "justify-center px-0.5",
    );
    const inner = (
      <>
        <Icon
          className="h-5 w-5 shrink-0 text-a-orange"
          strokeWidth={STROKE}
          aria-hidden
        />
        {expanded ? (
          <span className="truncate text-[12.5px] font-medium">{label}</span>
        ) : null}
      </>
    );
    if (href) {
      return (
        <li>
          <Link
            href={href}
            title={label}
            className={className}
            onClick={() => {
              setMobileNavOpen(false);
              onClick?.();
            }}
          >
            {inner}
          </Link>
        </li>
      );
    }
    return (
      <li>
        <button
          type="button"
          title={label}
          className={className}
          onClick={onClick}
        >
          {inner}
        </button>
      </li>
    );
  }

  function NavBody({ mobile = false }: { mobile?: boolean }) {
    const expanded = mobile || !railCollapsed;
    const repair =
      systemFromRegistry.find((m) => m.key === "repair") ?? null;
    const settingsMod =
      systemFromRegistry.find((m) => m.key === "settings") ?? null;

    return (
      <div className="flex h-full min-h-0 flex-col">
        {!mobile ? (
          <div
            className={cn(
              "flex h-9 shrink-0 items-center px-1.5",
              expanded ? "justify-end" : "justify-center",
            )}
          >
            <button
              type="button"
              title={railCollapsed ? t("expandNav") : t("collapseNav")}
              aria-label={
                railCollapsed ? t("expandNav") : t("collapseNav")
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
          <div className="h-2 shrink-0" />
        )}

        <nav
          className="a-ios-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1 pb-1.5"
          aria-label={t("modules")}
        >
          <SectionLabel expanded={expanded}>{t("modules")}</SectionLabel>
          <ul className="flex flex-col gap-px">
            {businessModules.map((mod) => (
              <ModuleRow key={mod.key} mod={mod} expanded={expanded} />
            ))}
          </ul>

          <div className="my-1.5 mx-2 h-px bg-a-surface-4/80" aria-hidden />

          <SectionLabel expanded={expanded}>{t("systemSection")}</SectionLabel>
          <ul className="flex flex-col gap-px">
            {repair ? (
              <ModuleRow mod={repair} expanded={expanded} />
            ) : (
              <SystemLink
                href="/repair"
                label="Réparation"
                icon={Wrench}
                expanded={expanded}
                onClick={() => activateModule("repair")}
              />
            )}
            <SystemLink
              href="/settings"
              label={settingsMod?.name ?? t("preferences")}
              icon={Settings2}
              expanded={expanded}
              onClick={() => {
                if (settingsMod) activateModule("settings");
              }}
            />
            <SystemLink
              href="/help"
              label={t("help")}
              icon={HelpCircle}
              expanded={expanded}
            />
            <SystemLink
              label={t("logout")}
              icon={LogOut}
              expanded={expanded}
              onClick={() => {
                setMobileNavOpen(false);
                void (async () => {
                  await logoutBusiness();
                  router.replace(BUSINESS_LOGIN_PATH);
                  router.refresh();
                })();
              }}
            />
          </ul>
        </nav>
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
          "a-glass-strong hidden h-full min-h-0 shrink-0 flex-col md:flex",
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
          "a-glass-strong fixed top-[3.75rem] bottom-0 left-0 z-[var(--a-z-dropdown)] flex w-[var(--a-sidebar-width)] flex-col md:hidden",
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

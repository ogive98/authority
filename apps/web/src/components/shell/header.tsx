"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Eye,
  Ghost,
  Languages,
  Menu,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications-store";
import { usePrefsStore } from "@/stores/prefs-store";
import { isNotifSourceKey } from "@/lib/notification-prefs";
import { useShellStore } from "@/stores/shell-store";
import { useLocaleStore, useShellT } from "@/stores/locale-store";
import { CompanyBrandPlate } from "./company-brand-plate";
import { ThemeModeSwitch } from "./mode-switch";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";
import { summonAuthorityX } from "@/lib/authority-x-summon";

function IconBtn({
  label,
  children,
  onClick,
  className,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "a-action-quiet inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Animated enter-only ops mode icon — disappears while mode is active. */
function OpsModeIcon({
  active,
  label,
  lockedHint,
  icon: Icon,
  toneClass,
  onEnter,
}: {
  active: boolean;
  label: string;
  lockedHint: string;
  icon: LucideIcon;
  toneClass: string;
  onEnter: () => void;
}) {
  if (active) return null;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onEnter}
      className={cn(
        "a-ops-mode-icon group relative inline-flex h-9 w-9 items-center justify-center rounded-full",
        "text-a-fg-muted transition-all duration-300 hover:scale-110 hover:bg-a-surface-3",
        toneClass,
      )}
    >
      <Icon
        className="h-4 w-4 transition-transform duration-500 group-hover:rotate-12"
        strokeWidth={1.5}
      />
      <span className="sr-only">{lockedHint}</span>
    </button>
  );
}

/**
 * Full-width topbar — ZIP Progressive OS: AUTHORITY · ⌘K · FR · Online · clock.
 */
export function ShellHeader() {
  const { t, unread: unreadLabel } = useShellT();
  const toggleLocale = useLocaleStore((s) => s.toggleLocale);
  const locale = useLocaleStore((s) => s.locale);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [axBusy, setAxBusy] = useState(false);
  const [axHint, setAxHint] = useState<string | null>(null);
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("fr-TN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  );
  const [netOnline, setNetOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const spectreEnabled = useShellStore((s) => s.spectreEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const ghostEnabled = useShellStore((s) => s.ghostEnabled);
  const enterSpectre = useShellStore((s) => s.enterSpectre);
  const enterPatch = useShellStore((s) => s.enterPatch);
  const enterGhost = useShellStore((s) => s.enterGhost);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const items = useNotificationsStore((s) => s.items);
  const notifMuted = usePrefsStore((s) => s.notifMuted);
  const unread = useMemo(
    () =>
      items.filter((n) => {
        if (n.read) return false;
        if (isNotifSourceKey(n.source) && notifMuted[n.source]) return false;
        return true;
      }).length,
    [items, notifMuted],
  );
  const [bellPulse, setBellPulse] = useState(false);

  useEffect(() => {
    const onPulse = () => {
      setBellPulse(true);
      window.setTimeout(() => setBellPulse(false), 3200);
    };
    window.addEventListener("authority:notif-bell-pulse", onPulse);
    return () =>
      window.removeEventListener("authority:notif-bell-pulse", onPulse);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(
        new Date().toLocaleTimeString("fr-TN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onOnline() {
      setNetOnline(true);
    }
    function onOffline() {
      setNetOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "dark"
        | "light"
        | null) ?? "dark";
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-spectre",
      spectreEnabled ? "on" : "off",
    );
  }, [spectreEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-patch",
      patchEnabled ? "on" : "off",
    );
  }, [patchEnabled]);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-ghost",
      ghostEnabled ? "on" : "off",
    );
  }, [ghostEnabled]);

  function applyTheme(next: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  async function openAuthorityX() {
    if (axBusy) return;
    setAxBusy(true);
    setAxHint(null);
    const result = await summonAuthorityX();
    setAxBusy(false);
    if (!result.ok) {
      setAxHint(t("authorityXOffline"));
      window.setTimeout(() => setAxHint(null), 4200);
    }
  }

  const anyOps = spectreEnabled || patchEnabled || ghostEnabled;

  return (
    <header className="relative z-[var(--a-z-sticky)] flex h-14 w-full shrink-0 items-center gap-3 border-b border-[color:var(--a-border-subtle)] bg-a-surface-1/95 px-3 backdrop-blur-md md:px-5">
      <button
        type="button"
        className="a-action-quiet inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted md:hidden"
        aria-label={t("expandNav")}
        aria-controls="shell-sidebar-mobile"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <Link
        href="/"
        className="shrink-0 text-[15px] font-bold tracking-[0.06em] text-a-fg md:text-[16px]"
      >
        AUTHORITY
      </Link>
      <CompanyBrandPlate className="hidden min-w-0 shrink-0 xl:flex" />

      <div className="flex min-w-0 flex-1 justify-center px-1 md:px-4">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "a-underlay flex h-9 w-full max-w-xl items-center gap-2.5 rounded-full px-4",
            "text-left text-[length:var(--a-text-sm)] text-a-fg-muted transition-colors",
            "hover:bg-a-surface-3 hover:text-a-fg",
          )}
          aria-label={t("searchAria")}
        >
          <Search className="h-4 w-4 shrink-0 text-a-accent" strokeWidth={1.5} />
          <span className="min-w-0 flex-1 truncate">{t("searchPlaceholder")}</span>
          <kbd className="a-mono hidden shrink-0 rounded-md bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-subtle sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <span className="mr-1 hidden items-center gap-2.5 text-[11px] font-medium text-a-fg-muted md:inline-flex">
          <button
            type="button"
            onClick={toggleLocale}
            className="uppercase tracking-wide text-a-fg hover:text-a-accent"
            aria-label={t("langToggle")}
          >
            {locale === "it" ? "IT" : "FR"}
          </button>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block size-1.5 rounded-full",
                netOnline ? "bg-a-success" : "bg-a-danger",
              )}
              aria-hidden
            />
            <span className={netOnline ? "text-a-fg" : "text-a-danger"}>
              {netOnline ? t("online") : t("wifiOffline")}
            </span>
          </span>
          <span className="a-mono text-a-fg-subtle">{clock}</span>
        </span>

        <button
          type="button"
          title={t("authorityXOpen")}
          aria-label={t("authorityXOpen")}
          disabled={axBusy}
          onClick={() => void openAuthorityX()}
          className={cn(
            "a-authority-x-orb group relative inline-flex h-9 w-9 shrink-0 items-center justify-center",
            "rounded-full text-[15px] font-bold tracking-tighter text-a-accent",
            "transition-transform duration-300 hover:scale-110",
            axBusy && "opacity-60",
          )}
        >
          <span className="relative z-[1] drop-shadow-[0_0_10px_color-mix(in_srgb,var(--a-accent)_55%,transparent)]">
            X
          </span>
        </button>
        {axHint ? (
          <span
            className="a-mono hidden max-w-[9rem] truncate text-[9px] text-a-warning sm:inline"
            role="status"
          >
            {axHint}
          </span>
        ) : null}

        <IconBtn
          label={unread > 0 ? unreadLabel(unread) : t("notifications")}
          onClick={() => setInboxOpen(true)}
          className={cn("relative", bellPulse && "a-notif-bell-pulse")}
        >
          <Bell className="h-4 w-4" strokeWidth={1.5} />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-a-danger px-1 text-[9px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </IconBtn>

        <div className="mx-0.5 hidden h-6 w-px bg-a-surface-4 sm:block" aria-hidden />

        <OpsModeIcon
          active={spectreEnabled}
          label={t("spectreEnter")}
          lockedHint={t("modeLockedHint")}
          icon={Eye}
          toneClass="hover:text-a-spectre"
          onEnter={enterSpectre}
        />
        <OpsModeIcon
          active={patchEnabled}
          label={t("patchEnter")}
          lockedHint={t("modeLockedHint")}
          icon={Wrench}
          toneClass="hover:text-a-warning"
          onEnter={enterPatch}
        />
        <OpsModeIcon
          active={ghostEnabled}
          label={t("ghostEnter")}
          lockedHint={t("modeLockedHint")}
          icon={Ghost}
          toneClass="hover:text-a-accent-2"
          onEnter={enterGhost}
        />

        {anyOps ? (
          <span
            className="a-mono hidden max-w-[7rem] truncate rounded-full bg-a-surface-3 px-2 py-0.5 text-[9px] text-a-fg-subtle xl:inline"
            title={t("modeLockedHint")}
          >
            {[
              spectreEnabled ? "SPECTRE" : null,
              patchEnabled ? "PATCH" : null,
              ghostEnabled ? "GHOST" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}

        <ThemeModeSwitch theme={theme} onThemeChange={applyTheme} />

        <button
          type="button"
          onClick={toggleLocale}
          title={t("langToggle")}
          aria-label={t("langToggle")}
          className="a-action-quiet inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted md:hidden"
        >
          <Languages className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}

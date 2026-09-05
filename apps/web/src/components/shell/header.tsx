"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { useNotificationsStore } from "@/stores/notifications-store";
import { unreadCount } from "@/lib/notifications";
import { useShellStore } from "@/stores/shell-store";
import {
  ModeSwitch,
  PatchIcon,
  SpectreIcon,
  ThemeModeSwitch,
} from "./mode-switch";
import { UserMenu } from "./user-menu";
import { cn } from "@/lib/utils";

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
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted transition-colors duration-150 hover:bg-a-surface-3 hover:text-a-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Utility Cube topbar — centered ⌘K search, utilities right, profile. */
export function ShellHeader() {
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const setMobileNavOpen = useShellStore((s) => s.setMobileNavOpen);
  const setPaletteOpen = useShellStore((s) => s.setPaletteOpen);
  const spectreEnabled = useShellStore((s) => s.spectreEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const setSpectreEnabled = useShellStore((s) => s.setSpectreEnabled);
  const setPatchEnabled = useShellStore((s) => s.setPatchEnabled);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const items = useNotificationsStore((s) => s.items);
  const unread = unreadCount(items);

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "dark"
        | "light"
        | null) ?? "light";
    setTheme(current);
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

  function applyTheme(next: "dark" | "light") {
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }

  return (
    <header className="a-glass sticky top-0 z-[var(--a-z-sticky)] flex h-14 shrink-0 items-center gap-3 border-b border-a-border-subtle px-4">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-white/50 md:hidden"
        aria-label="Ouvrir les modules"
        aria-controls="shell-sidebar-mobile"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-4 w-4" strokeWidth={1.75} />
      </button>

      <div className="flex min-w-0 flex-1 justify-center">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className={cn(
            "a-glass flex h-10 w-full max-w-xl items-center gap-2 rounded-[var(--a-radius-pill)] border border-a-border-subtle px-4",
            "text-left text-[length:var(--a-text-sm)] text-a-fg-subtle transition-colors duration-150",
            "hover:border-a-border-strong",
          )}
        >
          <Search className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="min-w-0 flex-1 truncate">Rechercher…</span>
          <kbd className="a-mono hidden shrink-0 rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-white/60 px-1.5 py-0.5 text-[10px] text-a-fg-subtle sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <IconBtn
          label={
            unread > 0
              ? `Notifications — ${unread} non lu${unread > 1 ? "s" : ""}`
              : "Notifications"
          }
          onClick={() => setInboxOpen(true)}
          className="relative"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unread > 0 ? (
            <span
              className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-a-danger"
              aria-hidden
            />
          ) : null}
        </IconBtn>

        <ModeSwitch
          className="hidden sm:inline-flex"
          label="SPECTRE MODE"
          icon={SpectreIcon}
          checked={spectreEnabled}
          onCheckedChange={setSpectreEnabled}
        />
        <ModeSwitch
          className="hidden xl:inline-flex"
          label="PATCH MODE"
          icon={PatchIcon}
          checked={patchEnabled}
          onCheckedChange={setPatchEnabled}
        />
        {patchEnabled ? (
          <span className="a-mono hidden rounded-[var(--a-radius-pill)] bg-a-warning-soft px-2 py-0.5 text-[10px] font-medium text-a-warning xl:inline">
            PATCH
          </span>
        ) : null}

        <ThemeModeSwitch theme={theme} onThemeChange={applyTheme} />
        <UserMenu />
      </div>
    </header>
  );
}

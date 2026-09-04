"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Building2,
  Command,
  Menu,
  Search,
} from "lucide-react";
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
        "inline-flex h-8 w-8 items-center justify-center rounded-[var(--a-radius-md)] text-a-fg-muted transition-colors hover:bg-a-surface-3 hover:text-a-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ShellHeader() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
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
        | null) ?? "dark";
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
    <header className="grid h-12 shrink-0 grid-cols-[1fr_auto] items-center gap-2 border-b border-a-border-subtle bg-a-surface-1 px-3 md:grid-cols-[auto_1fr_auto] md:px-4">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--a-radius-md)] text-a-fg-muted hover:bg-a-surface-3 md:hidden"
          aria-label="Ouvrir les modules"
          aria-controls="shell-sidebar-mobile"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <IconBtn label="Contexte société / site (stub)">
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </IconBtn>
      </div>

      <div className="hidden items-center justify-center gap-1 md:flex">
        <IconBtn
          label="Recherche / palette (Ctrl+K)"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </IconBtn>
        <IconBtn
          label="Palette de commandes (Ctrl+K)"
          onClick={() => setPaletteOpen(true)}
        >
          <Command className="h-4 w-4" strokeWidth={1.75} />
        </IconBtn>
      </div>

      <div className="flex items-center justify-end gap-2 sm:gap-3">
        <IconBtn
          label={
            unread > 0
              ? `Notifications — ${unread} non lu${unread > 1 ? "s" : ""}`
              : "Notifications — centre d’activité"
          }
          onClick={() => setInboxOpen(true)}
          className="relative"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
          {unread > 0 ? (
            <span
              className="absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-a-accent px-0.5 text-[9px] font-medium text-a-accent-fg"
              aria-hidden
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </IconBtn>

        <div
          className="hidden h-5 w-px bg-a-border-subtle sm:block"
          aria-hidden
        />

        <ModeSwitch
          className="hidden sm:inline-flex"
          label="SPECTRE MODE"
          icon={SpectreIcon}
          checked={spectreEnabled}
          onCheckedChange={setSpectreEnabled}
        />
        <ModeSwitch
          className="hidden lg:inline-flex"
          label="PATCH MODE"
          icon={PatchIcon}
          checked={patchEnabled}
          onCheckedChange={setPatchEnabled}
        />
        {patchEnabled ? (
          <span
            className="a-mono hidden rounded-[var(--a-radius-sm)] border border-a-warning/40 bg-a-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-a-warning lg:inline"
            title="PATCH MODE actif — correctifs hot-path"
          >
            PATCH
          </span>
        ) : null}

        <ThemeModeSwitch theme={theme} onThemeChange={applyTheme} />

        <UserMenu />
      </div>
    </header>
  );
}

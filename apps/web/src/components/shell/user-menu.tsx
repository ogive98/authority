"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type ShellUser = {
  name: string;
  role: string;
  initials: string;
  /** Profile photo URL when available from session / identity. */
  avatarUrl?: string | null;
};

/** Demo identity until auth session lands (SOC). */
const DEMO_USER: ShellUser = {
  name: "Karim Ben Ali",
  role: "Super Admin",
  initials: "KB",
  avatarUrl: null,
};

export type UserMenuProps = {
  user?: ShellUser;
};

function Avatar({ user, size }: { user: ShellUser; size: "md" | "lg" }) {
  const dim = size === "lg" ? "h-10 w-10 text-[length:var(--a-text-sm)]" : "h-9 w-9 text-[length:var(--a-text-sm)]";
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- session avatar URL, not a static asset
      <img
        src={user.avatarUrl}
        alt=""
        className={cn(dim, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-full bg-a-accent-muted font-semibold tracking-tight text-a-accent",
      )}
      aria-hidden
    >
      {user.initials}
    </span>
  );
}

export function UserMenu({ user = DEMO_USER }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        title="Profil"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-10 max-w-[12rem] items-center gap-2 rounded-[var(--a-radius-md)] bg-transparent pl-0.5 pr-1",
          "text-a-fg transition-colors hover:bg-a-surface-3",
          open && "bg-a-surface-3",
        )}
      >
        <Avatar user={user} size="lg" />
        <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
          <span className="max-w-[7.5rem] truncate text-[length:var(--a-text-xs)] font-medium text-a-fg">
            {user.name}
          </span>
          <span className="max-w-[7.5rem] truncate text-[10px] text-a-fg-subtle">
            {user.role}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 shrink-0 text-a-fg-subtle transition-transform sm:block",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Menu profil"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-[var(--a-z-dropdown)] w-56 overflow-hidden rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 shadow-[0_12px_32px_rgb(0_0_0_/_0.28)]"
        >
          <div className="flex items-center gap-3 border-b border-a-border-subtle px-3 py-3">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[length:var(--a-text-sm)] font-medium text-a-fg">
                {user.name}
              </p>
              <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                {user.role}
              </p>
            </div>
          </div>
          <ul className="p-1">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-[var(--a-radius-sm)] px-2.5 py-2 text-left text-[length:var(--a-text-sm)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
                onClick={() => setOpen(false)}
              >
                <User className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Compte (stub)
              </button>
            </li>
            <li role="none">
              <Link
                href="/settings"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-[var(--a-radius-sm)] px-2.5 py-2 text-[length:var(--a-text-sm)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
                onClick={() => setOpen(false)}
              >
                <Settings
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Préférences
              </Link>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-[var(--a-radius-sm)] px-2.5 py-2 text-left text-[length:var(--a-text-sm)] text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
                onClick={() => setOpen(false)}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Déconnexion (stub)
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}

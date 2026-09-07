"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Flag,
  Home,
  KeyRound,
  LayoutGrid,
  Radar,
  Workflow,
} from "lucide-react";
import { ASkipLink } from "@/components/a/a-skip-link";
import { SA_NAV } from "@/lib/super-admin-portal";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<(typeof SA_NAV)[number]["icon"], LucideIcon> = {
  home: Home,
  repair: Radar,
  modules: LayoutGrid,
  flags: Flag,
  license: KeyRound,
  jobs: Workflow,
};

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isRepair = pathname.startsWith("/super-admin/repair");

  return (
    <div
      className={cn(
        "flex min-h-screen text-a-fg",
        isRepair ? "repair-shell bg-[var(--a-gradient-canvas)]" : "bg-a-surface-1",
      )}
    >
      <ASkipLink />
      <aside
        className={cn(
          "flex w-56 shrink-0 flex-col border-r border-a-border-subtle",
          isRepair
            ? "bg-a-surface-2/70 backdrop-blur-[var(--a-glass-blur)]"
            : "bg-a-surface-1",
        )}
      >
        <div className="flex h-12 items-center gap-2 border-b border-a-border-subtle px-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--a-radius-sm)] bg-a-accent-muted text-a-accent">
            <Radar className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <p className="a-mono text-[length:var(--a-text-xs)] font-medium tracking-widest text-a-spectre">
            CONTROL
          </p>
        </div>
        <nav className="flex-1 p-2" aria-label="Control Center">
          <ul className="space-y-0.5">
            {SA_NAV.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active =
                item.href === "/super-admin"
                  ? pathname === "/super-admin"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--a-radius-md)] px-2.5 py-2 text-[length:var(--a-text-sm)]",
                      active
                        ? item.icon === "repair"
                          ? "bg-a-accent-muted font-medium text-a-accent-hover"
                          : "bg-a-surface-3 font-medium text-a-fg"
                        : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {item.label}
                    {item.icon === "repair" && active ? (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-a-accent repair-dot-pulse" />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "flex h-12 shrink-0 items-center justify-between border-b border-a-border-subtle px-4",
            isRepair && "bg-a-surface-2/50 backdrop-blur-[var(--a-glass-blur)]",
          )}
        >
          <p className="a-mono text-[length:var(--a-text-sm)] tracking-wide">
            AUTHORITY CONTROL CENTER
          </p>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            Realm super_admin · pas le shell métier
          </p>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

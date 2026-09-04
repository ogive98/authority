"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ASkipLink } from "@/components/a/a-skip-link";
import { SA_NAV } from "@/lib/super-admin-portal";
import { cn } from "@/lib/utils";

export function SuperAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-a-surface-1 text-a-fg">
      <ASkipLink />
      <aside className="flex w-52 shrink-0 flex-col border-r border-a-border-subtle bg-a-surface-1">
        <div className="flex h-12 items-center border-b border-a-border-subtle px-3">
          <p className="a-mono text-[length:var(--a-text-xs)] font-medium tracking-widest text-a-spectre">
            CC
          </p>
        </div>
        <nav className="flex-1 p-2" aria-label="Control Center">
          <ul className="space-y-0.5">
            {SA_NAV.map((item) => {
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
                      "block rounded-[var(--a-radius-md)] px-2.5 py-2 text-[length:var(--a-text-sm)]",
                      active
                        ? "bg-a-surface-3 font-medium text-a-fg"
                        : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-a-border-subtle px-4">
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

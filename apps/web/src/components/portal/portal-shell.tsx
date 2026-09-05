"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import {
  PORTAL_API,
  PORTAL_HOME_PATH,
  PORTAL_LOGIN_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";
import { cn } from "@/lib/utils";

const NAV = [
  { href: PORTAL_HOME_PATH, label: "Accueil" },
  { href: PORTAL_ORDERS_PATH, label: "Commandes" },
] as const;

export function PortalShell({
  children,
  customerLabel,
}: {
  children: ReactNode;
  customerLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    try {
      await fetch(PORTAL_API.logout, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } catch {
      /* still leave */
    }
    router.replace(PORTAL_LOGIN_PATH);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-a-surface-1 text-a-fg">
      <ASkipLink />
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-a-border-subtle px-[var(--a-space-5)]">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={PORTAL_HOME_PATH}
            className="text-[length:var(--a-text-sm)] font-medium tracking-tight text-a-fg"
          >
            AUTHORITY{" "}
            <span className="font-normal text-a-accent">Portal</span>
          </Link>
          {customerLabel ? (
            <span className="hidden truncate text-[length:var(--a-text-xs)] text-a-fg-muted sm:inline">
              {customerLabel}
            </span>
          ) : null}
          <nav
            className="flex items-center gap-1"
            aria-label="Navigation portail"
          >
            {NAV.map((item) => {
              const active =
                item.href === PORTAL_HOME_PATH
                  ? pathname === PORTAL_HOME_PATH
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-[var(--a-radius-sm)] px-2.5 py-1 text-[length:var(--a-text-sm)] font-normal transition-colors",
                    active
                      ? "bg-a-accent-muted text-a-accent"
                      : "text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <AButton
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void logout()}
        >
          Déconnexion
        </AButton>
      </header>
      <main id="main" className="min-h-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

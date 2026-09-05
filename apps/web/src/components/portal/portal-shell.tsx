"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import { PORTAL_API, PORTAL_HOME_PATH, PORTAL_LOGIN_PATH } from "@/lib/customer-portal";

export function PortalShell({
  children,
  customerLabel,
}: {
  children: ReactNode;
  customerLabel?: string;
}) {
  const router = useRouter();

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
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={PORTAL_HOME_PATH}
            className="text-[length:var(--a-text-sm)] font-medium tracking-tight text-a-fg"
          >
            AUTHORITY{" "}
            <span className="font-normal text-a-accent">Portal</span>
          </Link>
          {customerLabel ? (
            <span className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
              {customerLabel}
            </span>
          ) : null}
        </div>
        <AButton type="button" variant="ghost" size="sm" onClick={() => void logout()}>
          Déconnexion
        </AButton>
      </header>
      <main id="main" className="min-h-0 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

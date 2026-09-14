"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import {
  PORTAL_API,
  PORTAL_CLAIMS_PATH,
  PORTAL_DOCUMENTS_PATH,
  PORTAL_DELIVERIES_PATH,
  PORTAL_FINANCE_PATH,
  PORTAL_HOME_PATH,
  PORTAL_LOGIN_PATH,
  PORTAL_ORDERS_PATH,
  PORTAL_SALUBRITA_PATH,
} from "@/lib/customer-portal";

function navClass(active: boolean): string {
  return [
    "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium sm:px-3",
    active ? "bg-a-surface-3 text-a-fg" : "text-a-fg hover:bg-a-surface-3",
  ].join(" ");
}

const NAV = [
  { href: PORTAL_HOME_PATH, label: "Accueil", match: "exact" as const },
  { href: PORTAL_ORDERS_PATH, label: "Commandes", match: "prefix" as const },
  {
    href: PORTAL_DELIVERIES_PATH,
    label: "Livraisons",
    match: "prefix" as const,
  },
  { href: PORTAL_FINANCE_PATH, label: "Finance", match: "prefix" as const },
  {
    href: PORTAL_SALUBRITA_PATH,
    label: "Salubrité",
    match: "prefix" as const,
  },
  {
    href: PORTAL_CLAIMS_PATH,
    label: "Réclamations",
    match: "prefix" as const,
  },
  {
    href: PORTAL_DOCUMENTS_PATH,
    label: "Documents",
    match: "prefix" as const,
  },
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
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-a-surface-2/80 px-[var(--a-space-5)] backdrop-blur-[20px] backdrop-saturate-[180%]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={PORTAL_HOME_PATH}
            className="inline-flex min-w-0 shrink-0 items-center gap-2"
            aria-label="Fattorie Covelli Portal — Powered by AUTHORITY"
          >
            <Image
              src="/brand/company-logo.png"
              alt="Fattorie Covelli"
              width={160}
              height={44}
              className="a-brand-logo h-8 w-auto object-contain object-left"
              priority
            />
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle sm:inline">
              Portal
            </span>
          </Link>
          {customerLabel ? (
            <span className="hidden max-w-[14rem] truncate text-[length:var(--a-text-xs)] text-a-fg-muted lg:inline">
              {customerLabel}
            </span>
          ) : null}
        </div>
        <nav
          className="flex min-w-0 flex-wrap items-center justify-end gap-1 overflow-x-auto sm:gap-2"
          aria-label="Navigation portail"
        >
          {NAV.map((item) => {
            const active =
              item.match === "exact"
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navClass(active)}
              >
                {item.label}
              </Link>
            );
          })}
          <AButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void logout()}
          >
            Déconnexion
          </AButton>
        </nav>
      </header>
      <main id="main" className="min-h-0 flex-1 overflow-auto px-[var(--a-space-5)] py-[var(--a-space-5)]">
        {children}
      </main>
    </div>
  );
}

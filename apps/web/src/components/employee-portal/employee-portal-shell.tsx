"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AButton } from "@/components/a/a-button";
import { ASkipLink } from "@/components/a/a-skip-link";
import {
  EMPLOYEE_PORTAL_API,
  EMPLOYEE_PORTAL_BULLETINS_PATH,
  EMPLOYEE_PORTAL_CONGES_PATH,
  EMPLOYEE_PORTAL_DOCUMENTS_PATH,
  EMPLOYEE_PORTAL_HOME_PATH,
  EMPLOYEE_PORTAL_LOGIN_PATH,
  EMPLOYEE_PORTAL_PROFIL_PATH,
} from "@/lib/employee-portal";

function navClass(active: boolean): string {
  return [
    "a-action-quiet rounded-[var(--a-radius-sm)] px-2.5 py-1.5 text-[length:var(--a-text-sm)] font-medium sm:px-3",
    active ? "bg-a-surface-3 text-a-fg" : "text-a-fg hover:bg-a-surface-3",
  ].join(" ");
}

const NAV = [
  { href: EMPLOYEE_PORTAL_HOME_PATH, label: "Accueil", match: "exact" as const },
  {
    href: EMPLOYEE_PORTAL_CONGES_PATH,
    label: "Congés",
    match: "prefix" as const,
  },
  {
    href: EMPLOYEE_PORTAL_BULLETINS_PATH,
    label: "Bulletins",
    match: "prefix" as const,
  },
  {
    href: EMPLOYEE_PORTAL_DOCUMENTS_PATH,
    label: "Documents",
    match: "prefix" as const,
  },
  {
    href: EMPLOYEE_PORTAL_PROFIL_PATH,
    label: "Profil",
    match: "prefix" as const,
  },
];

export function EmployeePortalShell({
  children,
  employeeLabel,
}: {
  children: ReactNode;
  employeeLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    try {
      await fetch(EMPLOYEE_PORTAL_API.logout, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
    } catch {
      /* still leave */
    }
    router.replace(EMPLOYEE_PORTAL_LOGIN_PATH);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-a-surface-1 text-a-fg">
      <ASkipLink />
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-a-surface-2 px-[var(--a-space-5)]">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href={EMPLOYEE_PORTAL_HOME_PATH}
            className="inline-flex min-w-0 shrink-0 items-center gap-2.5"
            aria-label="Fattorie Covelli Employee Portal — Powered by AUTHORITY® · Haithem Hammami"
            title="Powered by AUTHORITY® · Haithem Hammami"
          >
            <Image
              src="/brand/company-logo.png"
              alt="Fattorie Covelli"
              width={160}
              height={44}
              className="a-brand-logo h-8 w-auto object-contain object-left"
              priority
            />
            <span className="hidden min-w-0 flex-col leading-[1.05] sm:flex">
              <span className="text-[9px] font-medium tracking-[0.04em] text-a-fg-subtle">
                Powered by
              </span>
              <span className="inline-flex items-baseline gap-0.5 text-[12px] font-medium tracking-[-0.02em] text-a-fg">
                AUTHORITY
                <sup className="text-[0.65em] text-a-fg-subtle" aria-label="marque déposée">
                  ®
                </sup>
              </span>
              <span className="text-[9px] text-a-fg-subtle">
                Haithem Hammami
              </span>
            </span>
          </Link>
          {employeeLabel ? (
            <span className="hidden max-w-[14rem] truncate text-[length:var(--a-text-xs)] text-a-fg-muted lg:inline">
              {employeeLabel}
            </span>
          ) : null}
        </div>
        <nav className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
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
      <main className="flex-1 px-[var(--a-space-5)] py-[var(--a-space-5)]">
        {children}
      </main>
    </div>
  );
}

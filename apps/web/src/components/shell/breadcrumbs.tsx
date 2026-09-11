"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocaleStore } from "@/stores/locale-store";
import { routeLabel } from "@/lib/i18n/route-labels";

function looksLikeRecordId(part: string): boolean {
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      part,
    )
  ) {
    return true;
  }
  if (/^c[a-z0-9]{20,}$/i.test(part)) return true;
  return false;
}

function labelForPart(
  part: string,
  parent: string | undefined,
  locale: "fr" | "it",
): string {
  if (looksLikeRecordId(part)) {
    if (
      parent === "products" ||
      parent === "customers" ||
      parent === "employees"
    ) {
      return routeLabel("fiche", locale, "fiche");
    }
    return routeLabel("detail", locale, "detail");
  }
  return routeLabel(part, locale);
}

/** Soft path bar — no frames. FR / IT via locale store (D184). */
export function ShellBreadcrumbs() {
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  if (pathname === "/") return null;

  const parts = pathname.split("/").filter(Boolean);
  const home = routeLabel("", locale);
  const crumbs = [
    { href: "/", label: home },
    ...parts.map((part, i) => ({
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: labelForPart(part, i > 0 ? parts[i - 1] : undefined, locale),
    })),
  ];

  return (
    <nav
      aria-label={locale === "it" ? "Percorso" : "Fil d’Ariane"}
      className="flex h-8 shrink-0 items-center gap-1.5 px-4 text-[12px] text-a-fg-muted"
    >
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="text-a-fg-subtle" aria-hidden>
                ›
              </span>
            ) : null}
            {last ? (
              <span className="font-medium text-a-fg" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="hover:text-a-accent">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

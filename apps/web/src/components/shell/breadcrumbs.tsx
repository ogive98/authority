"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  "": "Accueil",
  settings: "Paramètres",
  preferences: "Préférences",
  preview: "Aperçu",
  lots: "Lots",
  commandes: "Commandes",
};

/** Soft macOS path bar — no frames. */
export function ShellBreadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [
    { href: "/", label: "Accueil" },
    ...parts.map((part, i) => ({
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: LABELS[part] ?? part,
    })),
  ];

  return (
    <nav
      aria-label="Fil d’Ariane"
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

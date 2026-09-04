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

export function ShellBreadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  const crumbs = [
    { href: "/", label: "Accueil" },
    ...parts.map((part, i) => ({
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: LABELS[part] ?? part,
    })),
  ];

  // Avoid Accueil / Accueil on home
  const unique =
    parts.length === 0
      ? [{ href: "/", label: "Accueil" }]
      : crumbs;

  return (
    <nav
      aria-label="Fil d’Ariane"
      className="flex h-9 shrink-0 items-center gap-1.5 border-b border-a-border-subtle bg-a-surface-1 px-3 text-[length:var(--a-text-sm)] md:px-4"
    >
      {unique.map((c, i) => {
        const last = i === unique.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="text-a-fg-subtle" aria-hidden>
                /
              </span>
            ) : null}
            {last ? (
              <span className="font-medium text-a-fg" aria-current="page">
                {c.label}
              </span>
            ) : (
              <Link href={c.href} className="text-a-fg-muted hover:text-a-accent">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

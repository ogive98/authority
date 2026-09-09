"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** UI métier = français (ids techniques restent en anglais dans l’URL). */
const LABELS: Record<string, string> = {
  "": "Accueil",
  settings: "Paramètres",
  preferences: "Préférences",
  preview: "Aperçu",
  products: "Produits",
  customers: "Clients",
  sales: "Ventes",
  inventory: "Stock",
  lots: "Lots",
  "certificat-salubrite": "Certificat de salubrité",
  articles: "Certificat de salubrité",
  delivery: "Livraison",
  finance: "Finance",
  invoices: "Factures",
  payments: "Encaissements",
  instruments: "Instruments",
  promises: "Promesses",
  accounting: "Comptabilité",
  tax: "Fiscalité",
  hr: "Ressources humaines",
  production: "Production",
  repair: "Réparation",
  documents: "Documents",
  help: "Aide",
  guide: "Guide",
  commandes: "Commandes",
  search: "Recherche",
  portal: "Portail",
};

function looksLikeRecordId(part: string): boolean {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)) {
    return true;
  }
  // Prisma cuid / cuid2
  if (/^c[a-z0-9]{20,}$/i.test(part)) return true;
  return false;
}

function labelForPart(part: string, parent: string | undefined): string {
  if (LABELS[part]) return LABELS[part];
  if (looksLikeRecordId(part)) {
    if (parent === "products") return "Fiche";
    if (parent === "customers") return "Fiche";
    if (parent === "finance" || parent === "invoices") return "Détail";
    return "Détail";
  }
  return part;
}

/** Soft macOS path bar — no frames. Labels FR, jamais d’id brut. */
export function ShellBreadcrumbs() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const parts = pathname.split("/").filter(Boolean);
  const crumbs = [
    { href: "/", label: "Accueil" },
    ...parts.map((part, i) => ({
      href: "/" + parts.slice(0, i + 1).join("/"),
      label: labelForPart(part, i > 0 ? parts[i - 1] : undefined),
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

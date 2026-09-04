import Link from "next/link";
import { AScreenHeader } from "@/components/a/a-screen-header";

/** Visual-lock gallery — mock chrome only, not business modules. */

const SCREENS = [
  {
    href: "/",
    title: "Tableau de bord",
    blurb: "KPI + widgets isolés — chrome AppShell.",
  },
  {
    href: "/preview/lots",
    title: "Lots",
    blurb: "Liste stock · filtres · drawer fiche.",
  },
  {
    href: "/preview/commandes",
    title: "Commandes",
    blurb: "Table TND · statut texte · drawer.",
  },
  {
    href: "/settings",
    title: "Préférences",
    blurb: "Apparence dark/light · densité. Pas de langue V1.",
  },
] as const;

export default function PreviewHubPage() {
  return (
    <>
      <AScreenHeader
        title="Aperçu écrans"
        description="Maquettes métier dans le shell locké — mock data, pas de module Sales/Stock réel."
      />
      <div className="grid gap-4 p-[var(--a-space-6)] sm:grid-cols-2">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="a-card block p-[var(--a-space-5)] hover:bg-a-surface-3"
          >
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
              {s.blurb}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

import Link from "next/link";
import { AScreenHeader } from "@/components/a/a-screen-header";

/** Visual-lock gallery — mock chrome + real module entry points. */

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
    title: "Commandes (aperçu)",
    blurb: "Table + badges pastel + drawer — mock.",
  },
  {
    href: "/sales",
    title: "Ventes",
    blurb: "Module Sales réel — prise de commande multi-lignes.",
  },
  {
    href: "/delivery",
    title: "Livraison",
    blurb: "Module Delivery — tournées / stock issue.",
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
        description="Référence Utility Cube dans le shell — mock + modules réels."
      />
      <div className="grid gap-3 p-[var(--a-space-6)] sm:grid-cols-2 lg:grid-cols-3">
        {SCREENS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="a-card block p-[var(--a-space-5)] transition-colors hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              {s.title}
            </p>
            <p className="mt-1 text-[13px] font-normal text-a-fg-muted">
              {s.blurb}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

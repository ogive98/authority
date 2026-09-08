import Link from "next/link";
import { AScreenHeader } from "@/components/a";

const CHAPTERS = [
  {
    id: "context",
    title: "1. Contexte société",
    body: "Connectez-vous avec un utilisateur métier et un cookie `authority_company_id`. Sans contexte, les APIs renvoient 403 — le shell peut rester visible.",
  },
  {
    id: "modules",
    title: "2. Modules & Launchpad",
    body: "Activez un module par clic dans la sidebar. Les apps s’affichent centrées sur l’accueil, icônes outline colorées et animées.",
  },
  {
    id: "stock",
    title: "3. Stock & lots",
    body: "Lots et inventaire : quantités tabulaires. Ajustements uniquement via Inventory (y compris depuis la production).",
  },
  {
    id: "finance",
    title: "4. Finance",
    body: "Créances → factures (HT/TVA/TTC) → encaissements / instruments / promesses. FODEC & timbre seulement si Expertise VALIDATED.",
  },
  {
    id: "legal",
    title: "5. Légal Tunisie",
    body: "TVA = Tax Engine (`/tax`). FODEC, timbre, CNSS, IRPP, TFP = Préférences › Expertise. Jamais de taux inventés.",
  },
  {
    id: "repair",
    title: "6. Repair",
    body: "Scénarios SAFE/LOW allowlistés uniquement. Mission rail + audit local — pas de fake rollback.",
  },
  {
    id: "amounts",
    title: "7. Montants & SPECTRE",
    body: "TND / stock restent lisibles. SPECTRE masque le sensible à l’écran pendant démos et audits.",
  },
] as const;

export default function UserGuidePage() {
  return (
    <>
      <AScreenHeader
        kicker="Documentation"
        title="User Guide"
        description="Parcours AUTHORITY — fromagerie B2B Tunisie."
        actions={
          <Link
            href="/help"
            className="text-[13px] font-medium text-a-accent hover:underline"
          >
            ← Centre d’aide
          </Link>
        }
      />
      <div className="mx-auto max-w-2xl space-y-8 px-6 pb-16 pt-4 md:px-10">
        {CHAPTERS.map((ch) => (
          <section key={ch.id} id={ch.id} className="text-center">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-a-fg">
              {ch.title}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-a-fg-muted">
              {ch.body}
            </p>
          </section>
        ))}
        <p className="pt-4 text-center text-[12px] text-a-fg-subtle">
          Raccourcis :{" "}
          <Link href="/help#shortcuts" className="text-a-accent hover:underline">
            Centre d’aide
          </Link>
        </p>
      </div>
    </>
  );
}

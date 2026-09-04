import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { ADecimalField } from "@/components/a/a-decimal-field";
import { ADevPage } from "@/components/a/a-dev-page";
import { AInput } from "@/components/a/a-input";

export const metadata = {
  title: "Primitives — AUTHORITY UI-02",
  description: "A* wrappers gate — no raw hex in components",
};

export default function DevPrimitivesPage() {
  return (
    <ADevPage
      kicker="UI-02 · Primitives"
      title="A* components"
      extraActions={
        <Link
          href="/dev/tokens"
          className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
        >
          Tokens
        </Link>
      }
      mainClassName="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">AButton</h2>
        <div className="flex flex-wrap gap-3">
          <AButton>Primary</AButton>
          <AButton variant="secondary">Secondary</AButton>
          <AButton variant="outline">Outline</AButton>
          <AButton variant="ghost">Ghost</AButton>
          <AButton variant="danger">Danger</AButton>
          <AButton size="sm">Small</AButton>
          <AButton disabled>Disabled</AButton>
        </div>
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">AInput</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AInput placeholder="Référence commande" />
          <AInput placeholder="Désactivé" disabled />
        </div>
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">
          ADecimalField
        </h2>
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          Tabular + mono · surface solid (pas lightning sur TND / kg)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ADecimalField
            label="Montant"
            unit="TND"
            defaultValue="1234.560"
          />
          <ADecimalField
            label="Poids net"
            unit="kg"
            defaultValue="12450.000"
          />
          <ADecimalField
            label="Avec erreur"
            unit="TND"
            defaultValue="abc"
            error="Montant invalide"
          />
        </div>
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">ABadge</h2>
        <div className="flex flex-wrap gap-2">
          <ABadge>Neutral</ABadge>
          <ABadge tone="accent">Accent</ABadge>
          <ABadge tone="success">Paid</ABadge>
          <ABadge tone="warning">Pending</ABadge>
          <ABadge tone="danger">Overdue</ABadge>
          <ABadge tone="info">Info</ABadge>
          <ABadge tone="spectre">SPECTRE</ABadge>
        </div>
      </section>
    </ADevPage>
  );
}

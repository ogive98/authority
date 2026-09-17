"use client";

import { useState } from "react";
import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { ADecimalField } from "@/components/a/a-decimal-field";
import { ADevPage } from "@/components/a/a-dev-page";
import { ADialog } from "@/components/a/a-dialog";
import { AInput } from "@/components/a/a-input";
import { APagination } from "@/components/a/a-pagination";
import {
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import { ATabs } from "@/components/a/a-tabs";

export default function DevPrimitivesPage() {
  const [tab, setTab] = useState("one");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <ADevPage
      kicker="UI-02 · Stage 2"
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
      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
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

      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">AInput</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <AInput placeholder="Référence commande" />
          <AInput placeholder="Désactivé" disabled />
        </div>
      </section>

      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
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

      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
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

      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">
          ATabs · ADialog · APagination
        </h2>
        <ATabs
          ariaLabel="Démo onglets"
          value={tab}
          onValueChange={setTab}
          items={[
            { id: "one", label: "Synthèse" },
            { id: "two", label: "Documents" },
            { id: "three", label: "Communication" },
          ]}
        />
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          Onglet actif : {tab}
        </p>
        <AButton type="button" size="sm" onClick={() => setDialogOpen(true)}>
          Ouvrir ADialog
        </AButton>
        <ADialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Dialogue AUTHORITY"
          description="Modal général — les confirms à risque restent sur AConfirmDialog."
          footer={
            <AButton type="button" size="sm" onClick={() => setDialogOpen(false)}>
              Fermer
            </AButton>
          }
        >
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Contenu libre — tokens `--a-*` only.
          </p>
        </ADialog>
        <APagination
          label={`Page ${page}`}
          previousDisabled={page <= 1}
          nextDisabled={page >= 3}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(3, p + 1))}
        />
      </section>

      <section className="a-underlay space-y-4 rounded-[var(--a-radius-md)] p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-semibold">
          ASoftTable
        </h2>
        <ASoftTable>
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>Réf.</ASoftTh>
              <ASoftTh>Client</ASoftTh>
              <ASoftTh numeric>Montant</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            <ASoftTr>
              <ASoftTd>SO-1001</ASoftTd>
              <ASoftTd>Fattorie Covelli</ASoftTd>
              <ASoftTd numeric className="a-mono">
                1 250,000
              </ASoftTd>
            </ASoftTr>
            <ASoftTr>
              <ASoftTd>SO-1002</ASoftTd>
              <ASoftTd>Fromagerie Atlas</ASoftTd>
              <ASoftTd numeric className="a-mono">
                840,500
              </ASoftTd>
            </ASoftTr>
          </tbody>
        </ASoftTable>
      </section>
    </ADevPage>
  );
}

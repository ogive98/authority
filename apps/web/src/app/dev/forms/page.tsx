"use client";

import { useState } from "react";
import {
  AButton,
  AConfirmDialog,
  ADevPage,
  ADrawer,
  ADynamicForm,
  weightSplitFields,
  weightSplitSchema,
  type WeightSplitValues,
} from "@/components/a";
import { createIdempotencyKey } from "@/lib/idempotency";

export default function DevFormsPage() {
  const [stockOpen, setStockOpen] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [lastSubmit, setLastSubmit] = useState<WeightSplitValues | null>(null);

  return (
    <ADevPage
      kicker="UI-07 · Forms + overlays"
      title="Formulaires & confirmations"
      description="Gate : wording stock / argent · Idempotency-Key · drawer fiche"
      mainClassName="mx-auto grid max-w-4xl gap-6 px-[var(--a-space-6)] py-[var(--a-space-7)] lg:grid-cols-2"
      overlay={
        <>
          <AConfirmDialog
            open={stockOpen}
            onOpenChange={setStockOpen}
            risk="stock"
            consequence="Vous allez sortir 12,450 kg du lot LOT-2026-0042 (site Sfax). Le stock disponible diminuera immédiatement."
            confirmPhrase="SORTIR 12,450 kg"
            confirmLabel="Confirmer la sortie"
            onConfirm={(key) => setLastKey(key)}
          />
          <AConfirmDialog
            open={moneyOpen}
            onOpenChange={setMoneyOpen}
            risk="money"
            consequence="Vous allez encaisser 1 234,560 TND pour la commande SO-2026-0042. Ce montant sera comptabilisé."
            confirmPhrase="1 234,560 TND"
            confirmLabel="Confirmer l’encaissement"
            onConfirm={(key) => setLastKey(key)}
          />
          <ADrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title="LOT-2026-0042"
            description="Fiche lot — drawer"
            footer={
              <div className="flex justify-end gap-2">
                <AButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDrawerOpen(false)}
                >
                  Fermer
                </AButton>
                <AButton
                  type="button"
                  size="sm"
                  onClick={() => setDrawerOpen(false)}
                >
                  OK
                </AButton>
              </div>
            }
          >
            <dl className="space-y-3 text-[length:var(--a-text-sm)]">
              <div>
                <dt className="text-a-fg-muted">SKU</dt>
                <dd className="a-mono">SKU-BRIE-250</dd>
              </div>
              <div>
                <dt className="text-a-fg-muted">Poids net</dt>
                <dd className="a-mono a-tabular">12 450,000 kg</dd>
              </div>
              <div>
                <dt className="text-a-fg-muted">DLC</dt>
                <dd>2026-09-18</dd>
              </div>
              <div>
                <dt className="text-a-fg-muted">Site</dt>
                <dd>Sfax</dd>
              </div>
            </dl>
          </ADrawer>
        </>
      }
    >
      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">
          DynamicForm — poids
        </h2>
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          Distingue qté commandée / préparé / facturé. Pas de{" "}
          <span className="a-mono">type=number</span> float.
        </p>
        <ADynamicForm
          fields={weightSplitFields}
          schema={weightSplitSchema}
          defaultValues={{
            reference: "",
            qtyOrdered: "",
            weightPrepared: "",
            weightInvoiced: "",
          }}
          submitLabel="Enregistrer brouillon"
          onSubmit={(values) => {
            setLastSubmit(values);
            setLastKey(createIdempotencyKey("form"));
          }}
        />
        {lastSubmit ? (
          <pre className="a-mono overflow-auto rounded-[var(--a-radius-md)] bg-a-surface-3 p-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
            {JSON.stringify({ key: lastKey, ...lastSubmit }, null, 2)}
          </pre>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="a-card space-y-3 p-[var(--a-space-5)]">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Confirm danger
          </h2>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Stock et argent : wording explicite + type-to-confirm.
          </p>
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              size="sm"
              variant="danger"
              onClick={() => setStockOpen(true)}
            >
              Sortie stock 12,450 kg
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant="danger"
              onClick={() => setMoneyOpen(true)}
            >
              Encaisser 1 234,560 TND
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDrawerOpen(true)}
            >
              Ouvrir fiche drawer
            </AButton>
          </div>
        </div>

        <div className="a-card space-y-2 p-[var(--a-space-5)]">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Idempotency helper
          </h2>
          <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
            createIdempotencyKey() → une clé par intention utilisateur
          </p>
          <AButton
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setLastKey(createIdempotencyKey("demo"))}
          >
            Générer une clé
          </AButton>
          {lastKey ? (
            <p className="a-mono break-all text-[length:var(--a-text-sm)]">
              {lastKey}
            </p>
          ) : null}
        </div>
      </section>
    </ADevPage>
  );
}

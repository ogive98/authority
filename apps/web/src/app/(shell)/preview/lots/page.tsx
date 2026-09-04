"use client";

import { useMemo, useState } from "react";
import {
  AButton,
  ADrawer,
  AKpiCard,
  AScreenHeader,
} from "@/components/a";
import { ADataTableLots } from "@/components/a/a-data-table-lots";
import { buildMockLots, type LotRow } from "@/lib/mock-lots";

export default function PreviewLotsPage() {
  const rows = useMemo(() => buildMockLots(120), []);
  const [lot, setLot] = useState<LotRow | null>(null);

  return (
    <>
      <AScreenHeader
        title="Lots"
        description="Stock fromage · site Sfax — mock UI-06 dans le shell."
        actions={
          <AButton type="button" size="sm">
            Nouveau lot
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <section className="grid gap-4 sm:grid-cols-3">
          <AKpiCard label="Lots ouverts" value="42" delta="+3" deltaTone="success" />
          <AKpiCard
            label="Poids net"
            value="12 450,000 kg"
            delta="−2,1 %"
            deltaTone="warning"
          />
          <AKpiCard
            label="Quarantaine"
            value="8"
            delta="DLC"
            deltaTone="danger"
          />
        </section>
        <ADataTableLots rows={rows} onRowClick={setLot} />
      </div>
      <ADrawer
        open={lot !== null}
        onOpenChange={(open) => {
          if (!open) setLot(null);
        }}
        title={lot?.id ?? "Lot"}
        description="Fiche lot — drawer"
        footer={
          <div className="flex justify-end">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setLot(null)}
            >
              Fermer
            </AButton>
          </div>
        }
      >
        {lot ? (
          <dl className="space-y-3 text-[length:var(--a-text-sm)]">
            <div>
              <dt className="text-a-fg-muted">SKU</dt>
              <dd className="a-mono">{lot.sku}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Produit</dt>
              <dd>{lot.name}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Poids net</dt>
              <dd className="a-mono a-tabular">
                {lot.qtyKg.toLocaleString("fr-TN", {
                  minimumFractionDigits: 3,
                  maximumFractionDigits: 3,
                })}{" "}
                kg
              </dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Statut</dt>
              <dd className="capitalize">{lot.status}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">DLC</dt>
              <dd className="a-mono">{lot.dlc}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Site</dt>
              <dd>{lot.site}</dd>
            </div>
          </dl>
        ) : null}
      </ADrawer>
    </>
  );
}

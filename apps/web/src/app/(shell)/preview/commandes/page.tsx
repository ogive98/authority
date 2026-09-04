"use client";

import { useState } from "react";
import {
  AButton,
  ADrawer,
  AKpiCard,
  AScreenHeader,
} from "@/components/a";
import {
  MOCK_ORDERS,
  orderStatusLabel,
  type OrderRow,
} from "@/lib/mock-orders";

export default function PreviewCommandesPage() {
  const [order, setOrder] = useState<OrderRow | null>(null);

  return (
    <>
      <AScreenHeader
        title="Commandes"
        description="Ventes B2B · TND — mock chrome, pas le module Sales."
        actions={
          <AButton type="button" size="sm">
            Nouvelle commande
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <section className="grid gap-4 sm:grid-cols-3">
          <AKpiCard
            label="Encaissé (7 j)"
            value="21 459,560 TND"
            delta="+8,2 %"
            deltaTone="success"
          />
          <AKpiCard label="En attente" value="24 320,560 TND" delta="2" />
          <AKpiCard
            label="En retard"
            value="8 910,000 TND"
            delta="1"
            deltaTone="danger"
          />
        </section>

        <div className="overflow-x-auto rounded-[var(--a-radius-lg)] border border-a-border-subtle">
          <table className="w-full min-w-[640px] border-collapse text-left text-[length:var(--a-text-sm)]">
            <thead className="bg-a-surface-3 text-a-fg-muted">
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Client</th>
                <th className="a-table-cell text-right font-medium">Montant</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Échéance</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ORDERS.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t border-a-border-subtle hover:bg-a-surface-3/60"
                  onClick={() => setOrder(row)}
                >
                  <td className="a-mono a-table-cell">{row.id}</td>
                  <td className="a-table-cell">{row.client}</td>
                  <td className="a-mono a-tabular a-table-cell text-right">
                    {row.amountTnd} TND
                  </td>
                  <td className="a-table-cell">
                    <span
                      className={
                        row.status === "paid"
                          ? "font-medium text-a-success"
                          : row.status === "pending"
                            ? "font-medium text-a-warning"
                            : "font-medium text-a-danger"
                      }
                    >
                      {orderStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="a-mono a-table-cell">{row.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ADrawer
        open={order !== null}
        onOpenChange={(open) => {
          if (!open) setOrder(null);
        }}
        title={order?.id ?? "Commande"}
        description="Fiche commande — drawer"
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOrder(null)}
            >
              Fermer
            </AButton>
            <AButton type="button" size="sm">
              OK
            </AButton>
          </div>
        }
      >
        {order ? (
          <dl className="space-y-3 text-[length:var(--a-text-sm)]">
            <div>
              <dt className="text-a-fg-muted">Client</dt>
              <dd>{order.client}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Montant</dt>
              <dd className="a-mono a-tabular">{order.amountTnd} TND</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Statut</dt>
              <dd>{orderStatusLabel(order.status)}</dd>
            </div>
            <div>
              <dt className="text-a-fg-muted">Échéance</dt>
              <dd className="a-mono">{order.due}</dd>
            </div>
          </dl>
        ) : null}
      </ADrawer>
    </>
  );
}

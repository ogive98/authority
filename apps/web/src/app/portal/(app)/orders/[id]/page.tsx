import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchOrder,
  portalOrderBadgeTone,
  portalOrderStatusLabel,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data: order } = await fetchOrder(id);

  if (status === 404) {
    notFound();
  }

  if (status !== 200 || !order) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Commande" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message="Impossible de charger cette commande."
            retryable={false}
          />
          <p className="mt-4">
            <Link
              href={PORTAL_ORDERS_PATH}
              className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            >
              ← Retour aux commandes
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title={order.number}
        description="Détail de la commande"
        actions={
          <Link href={PORTAL_ORDERS_PATH}>
            <span className="text-[length:var(--a-text-sm)] text-a-accent hover:underline">
              ← Commandes
            </span>
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <div className="a-card grid gap-4 p-[var(--a-space-5)] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Statut
            </p>
            <div className="mt-1">
              <ABadge tone={portalOrderBadgeTone(order.status)}>
                {portalOrderStatusLabel(order.status)}
              </ABadge>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Date demandée
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-sm)]">
              {order.requestedDate ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Montant
            </p>
            <p className="a-mono a-tabular mt-1 text-[length:var(--a-text-sm)] font-medium">
              {order.amountTotal} {order.currency}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Chauffeur préféré
            </p>
            <p className="mt-1 text-[length:var(--a-text-sm)]">
              {order.preferredDriver ?? "—"}
            </p>
          </div>
        </div>

        <div className="a-card overflow-hidden">
          <div className="border-b border-a-border-subtle px-4 py-3">
            <h2 className="text-[length:var(--a-text-sm)] font-medium">
              Lignes
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">SKU</th>
                  <th className="a-table-cell font-medium">Produit</th>
                  <th className="a-table-cell text-right font-medium">Qté</th>
                  <th className="a-table-cell text-right font-medium">P.U.</th>
                  <th className="a-table-cell text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line, idx) => (
                  <tr
                    key={`${line.sku ?? "line"}-${idx}`}
                    className="border-t border-a-border-subtle"
                  >
                    <td className="a-mono a-table-cell">{line.sku ?? "—"}</td>
                    <td className="a-table-cell">{line.name ?? "—"}</td>
                    <td className="a-mono a-tabular a-table-cell text-right">
                      {line.qty}
                    </td>
                    <td className="a-mono a-tabular a-table-cell text-right">
                      {line.unitPrice}
                    </td>
                    <td className="a-mono a-tabular a-table-cell text-right">
                      {line.lineTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

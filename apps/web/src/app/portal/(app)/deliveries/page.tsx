import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchDeliveries,
  portalDeliveryBadgeTone,
  portalDeliveryStatusLabel,
  PORTAL_DELIVERIES_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalDeliveriesPage() {
  const { status, data } = await fetchDeliveries({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Livraisons" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les livraisons."
            }
            retryable={false}
          />
        </div>
      </div>
    );
  }

  const items = data.items;

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Livraisons"
        description={`${items.length} expédition${items.length === 1 ? "" : "s"} · suivi statut (pas d’ETA GPS)`}
        actions={
          <Link
            href="/portal/preview/journey"
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            Voir un exemple →
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        {items.length === 0 ? (
          <AEmptyState
            title="Aucune livraison"
            description="Les expéditions liées à vos commandes apparaîtront ici. Un exemple fictif est disponible pour visualiser le parcours."
            canAct={false}
          />
        ) : (
          <div className="a-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[length:var(--a-text-sm)]">
                <thead className="bg-a-surface-3/80 text-a-fg-muted">
                  <tr>
                    <th className="a-table-cell font-medium">N°</th>
                    <th className="a-table-cell font-medium">Commande</th>
                    <th className="a-table-cell font-medium">Statut</th>
                    <th className="a-table-cell font-medium">Livreur</th>
                    <th className="a-table-cell font-medium">Créée</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-a-border-subtle transition-colors hover:bg-a-surface-3/50"
                    >
                      <td className="a-table-cell">
                        <Link
                          href={`${PORTAL_DELIVERIES_PATH}/${row.id}`}
                          className="a-mono font-medium text-a-accent hover:underline"
                        >
                          {row.number}
                        </Link>
                      </td>
                      <td className="a-table-cell">
                        {row.orderNumber ? (
                          <Link
                            href={`${PORTAL_ORDERS_PATH}/${row.orderId}`}
                            className="a-mono text-a-fg hover:underline"
                          >
                            {row.orderNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="a-table-cell">
                        <ABadge tone={portalDeliveryBadgeTone(row.status)}>
                          {portalDeliveryStatusLabel(row.status)}
                        </ABadge>
                      </td>
                      <td className="a-table-cell">
                        {row.driverLabel ?? "—"}
                      </td>
                      <td className="a-mono a-table-cell text-a-fg-muted">
                        {row.createdAt.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

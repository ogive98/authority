import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import {
  fetchDeliveries,
  portalDeliveryBadgeTone,
  portalDeliveryStatusLabel,
  PORTAL_DELIVERIES_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";
import { softGhostBtn } from "@/lib/d294-ui";

export default async function PortalDeliveriesPage() {
  const { status, data } = await fetchDeliveries({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Livraisons" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les livraisons."
            }
            retryable={false}
          />
        </APageBody>
      </>
    );
  }

  const items = data.items;

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title="Livraisons"
        description={`${items.length} expédition${items.length === 1 ? "" : "s"} · ouvrez une ligne pour le parcours interactif`}
        actions={
          <Link href="/portal/preview/journey" className={softGhostBtn}>
            Voir un exemple →
          </Link>
        }
      />
      <APageBody>
        {items.length === 0 ? (
          <div className="space-y-3">
            <AEmptyState
              title="Aucune livraison"
              description="Les expéditions liées à vos commandes apparaîtront ici."
              canAct={false}
            />
            <p className="text-[length:var(--a-text-sm)]">
              <Link
                href="/portal/preview/journey"
                className="text-a-accent hover:underline"
              >
                Ouvrir le parcours exemple (schéma interactif) →
              </Link>
            </p>
          </div>
        ) : (
          <ASoftTable className="min-w-[560px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Commande</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Livreur</th>
                <th className="a-table-cell font-medium">Créée</th>
              </tr>
            </ASoftThead>
            <tbody>
              {items.map((row) => (
                <ASoftTr key={row.id}>
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
                  <td className="a-table-cell">{row.driverLabel ?? "—"}</td>
                  <td className="a-mono a-table-cell text-a-fg-muted">
                    {row.createdAt.slice(0, 10)}
                  </td>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        )}
      </APageBody>
    </>
  );
}

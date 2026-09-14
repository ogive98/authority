import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
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
  fetchOrders,
  portalOrderBadgeTone,
  portalOrderStatusLabel,
  PORTAL_ORDERS_NEW_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalOrdersPage() {
  const { status, data } = await fetchOrders({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Commandes" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les commandes."
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
        title="Commandes"
        description={`${items.length} commande${items.length === 1 ? "" : "s"}`}
        actions={
          <Link href={PORTAL_ORDERS_NEW_PATH}>
            <AButton type="button">Nouvelle commande</AButton>
          </Link>
        }
      />
      <APageBody>
        {items.length === 0 ? (
          <AEmptyState
            title="Aucune commande"
            description="Créez un brouillon depuis le catalogue, ou recommandez une commande existante."
            canAct={false}
          />
        ) : (
          <ASoftTable className="min-w-[560px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Date demandée</th>
                <th className="a-table-cell text-right font-medium">Montant</th>
                <th className="a-table-cell font-medium">Créée</th>
              </tr>
            </ASoftThead>
            <tbody>
              {items.map((row) => (
                <ASoftTr key={row.id}>
                  <td className="a-table-cell">
                    <Link
                      href={`${PORTAL_ORDERS_PATH}/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                    >
                      {row.number}
                    </Link>
                  </td>
                  <td className="a-table-cell">
                    <ABadge tone={portalOrderBadgeTone(row.status)}>
                      {portalOrderStatusLabel(row.status)}
                    </ABadge>
                  </td>
                  <td className="a-mono a-table-cell text-a-fg-muted">
                    {row.requestedDate ?? "—"}
                  </td>
                  <td className="a-mono a-tabular a-table-cell text-right">
                    {row.amountTotal} {row.currency}
                  </td>
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

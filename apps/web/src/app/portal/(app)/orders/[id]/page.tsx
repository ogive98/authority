import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import { PortalPackageJourney } from "@/components/portal/portal-package-journey";
import { PortalReorderButton } from "@/components/portal/portal-reorder-button";
import {
  fetchDeliveries,
  fetchOrder,
  portalOrderBadgeTone,
  portalOrderStatusLabel,
  PORTAL_DELIVERIES_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ status, data: order }, deliveriesRes] = await Promise.all([
    fetchOrder(id),
    fetchDeliveries({ orderId: id, limit: 5 }),
  ]);

  if (status === 404) {
    notFound();
  }

  if (status !== 200 || !order) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Commande" />
        <APageBody>
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
        </APageBody>
      </>
    );
  }

  const linkedDelivery =
    deliveriesRes.status === 200 && deliveriesRes.data
      ? (deliveriesRes.data.items[0] ?? null)
      : null;

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title={order.number}
        description="Détail de la commande"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link href={PORTAL_ORDERS_PATH}>
              <span className="text-[length:var(--a-text-sm)] text-a-accent hover:underline">
                ← Commandes
              </span>
            </Link>
            <PortalReorderButton orderId={order.id} />
          </div>
        }
      />
      <APageBody>
        {linkedDelivery ? (
          <div className="space-y-2">
            <PortalPackageJourney delivery={linkedDelivery} />
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Expédition{" "}
              <Link
                href={`${PORTAL_DELIVERIES_PATH}/${linkedDelivery.id}`}
                className="a-mono text-a-accent hover:underline"
              >
                {linkedDelivery.number}
              </Link>
            </p>
          </div>
        ) : (
          <div className="a-underlay rounded-md border-dashed p-[var(--a-space-4)]">
            <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              Parcours colis
            </p>
            <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
              {order.status === "CONFIRMED"
                ? "Commande confirmée — en attente de création d’expédition côté ADV / logistique."
                : order.status === "DRAFT"
                  ? "Brouillon — le suivi colis apparaîtra après confirmation et expédition."
                  : "Aucune expédition liée à cette commande pour le moment."}
            </p>
          </div>
        )}

        <div className="a-underlay rounded-md grid gap-4 p-[var(--a-space-5)] sm:grid-cols-2 lg:grid-cols-4">
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

        <section className="space-y-2">
          <h2 className="text-[length:var(--a-text-sm)] font-medium">
            Lignes
          </h2>
          <ASoftTable className="min-w-[480px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">SKU</th>
                <th className="a-table-cell font-medium">Produit</th>
                <th className="a-table-cell text-right font-medium">Qté</th>
                <th className="a-table-cell text-right font-medium">P.U.</th>
                <th className="a-table-cell text-right font-medium">Total</th>
              </tr>
            </ASoftThead>
            <tbody>
              {order.lines.map((line, idx) => (
                <ASoftTr key={`${line.sku ?? "line"}-${idx}`}>
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
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        </section>
      </APageBody>
    </div>
  );
}

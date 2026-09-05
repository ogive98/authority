import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import { PortalPackageJourney } from "@/components/portal/portal-package-journey";
import {
  fetchDelivery,
  portalDeliveryBadgeTone,
  portalDeliveryStatusLabel,
  PORTAL_DELIVERIES_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalDeliveryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data: delivery } = await fetchDelivery(id);

  if (status === 404) {
    notFound();
  }

  if (status !== 200 || !delivery) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Livraison" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message="Impossible de charger cette livraison."
            retryable={false}
          />
          <p className="mt-4">
            <Link
              href={PORTAL_DELIVERIES_PATH}
              className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            >
              ← Retour aux livraisons
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
        title={delivery.number}
        description="Suivi d’expédition — schéma interactif du statut réel"
        actions={
          <Link href={PORTAL_DELIVERIES_PATH}>
            <span className="text-[length:var(--a-text-sm)] text-a-accent hover:underline">
              ← Livraisons
            </span>
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <PortalPackageJourney delivery={delivery} />

        <div className="a-card grid gap-4 p-[var(--a-space-5)] sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Statut
            </p>
            <div className="mt-1">
              <ABadge tone={portalDeliveryBadgeTone(delivery.status)}>
                {portalDeliveryStatusLabel(delivery.status)}
              </ABadge>
            </div>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Commande
            </p>
            <p className="mt-1 text-[length:var(--a-text-sm)]">
              {delivery.orderNumber ? (
                <Link
                  href={`${PORTAL_ORDERS_PATH}/${delivery.orderId}`}
                  className="a-mono text-a-accent hover:underline"
                >
                  {delivery.orderNumber}
                </Link>
              ) : (
                "—"
              )}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Livreur
            </p>
            <p className="mt-1 text-[length:var(--a-text-sm)]">
              {delivery.driverLabel ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Assigné
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-sm)]">
              {delivery.assignedAt?.slice(0, 16).replace("T", " ") ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              En route
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-sm)]">
              {delivery.dispatchedAt?.slice(0, 16).replace("T", " ") ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Terminé
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-sm)]">
              {delivery.completedAt?.slice(0, 16).replace("T", " ") ?? "—"}
            </p>
          </div>
        </div>

        {delivery.status === "FAILED" && delivery.failReason ? (
          <div className="a-card border-a-warning/30 bg-a-warning-soft/40 p-[var(--a-space-4)]">
            <p className="text-[length:var(--a-text-xs)] text-a-warning-fg">
              Motif d’échec
            </p>
            <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg">
              {delivery.failReason}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

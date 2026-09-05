import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchClaim,
  portalClaimBadgeTone,
  portalClaimStatusLabel,
  portalClaimTypeLabel,
  PORTAL_CLAIMS_PATH,
  PORTAL_DELIVERIES_PATH,
  PORTAL_ORDERS_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data } = await fetchClaim(id);

  if (shouldHidePortal(status) || status === 404) {
    notFound();
  }

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Réclamation" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message="Impossible de charger cette réclamation."
            retryable={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title={data.number}
        description={data.subject}
        actions={
          <Link
            href={PORTAL_CLAIMS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Réclamations
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <div className="flex flex-wrap items-center gap-3">
          <ABadge tone={portalClaimBadgeTone(data.status)}>
            {portalClaimStatusLabel(data.status)}
          </ABadge>
          <span className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            {portalClaimTypeLabel(data.type)}
          </span>
          <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
            {data.createdAt.slice(0, 10)}
          </span>
        </div>

        <div className="a-card space-y-3 p-4">
          <p className="whitespace-pre-wrap text-[length:var(--a-text-sm)]">
            {data.description}
          </p>
          <div className="flex flex-wrap gap-4 text-[length:var(--a-text-sm)]">
            {data.orderId && data.orderNumber ? (
              <Link
                href={`${PORTAL_ORDERS_PATH}/${data.orderId}`}
                className="a-mono text-a-accent hover:underline"
              >
                Commande {data.orderNumber}
              </Link>
            ) : null}
            {data.shipmentId && data.shipmentNumber ? (
              <Link
                href={`${PORTAL_DELIVERIES_PATH}/${data.shipmentId}`}
                className="a-mono text-a-accent hover:underline"
              >
                Livraison {data.shipmentNumber}
              </Link>
            ) : null}
          </div>
          {data.resolutionNote ? (
            <p className="border-t border-a-border-subtle pt-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Résolution : {data.resolutionNote}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

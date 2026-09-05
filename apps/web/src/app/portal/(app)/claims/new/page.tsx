import { AErrorState } from "@/components/a/a-error-state";
import { PortalNewClaimForm } from "@/components/portal/portal-new-claim-form";
import { fetchDeliveries, fetchOrders } from "@/lib/customer-portal";

export default async function PortalNewClaimPage() {
  const [{ status: oStatus, data: orders }, { status: dStatus, data: deliveries }] =
    await Promise.all([
      fetchOrders({ limit: 50 }),
      fetchDeliveries({ limit: 50 }),
    ]);

  if (oStatus !== 200 || dStatus !== 200 || !orders || !deliveries) {
    return (
      <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <AErrorState
          message={
            oStatus === 401 ||
            oStatus === 403 ||
            dStatus === 401 ||
            dStatus === 403
              ? "Session portail expirée ou refusée."
              : "Impossible de préparer le formulaire."
          }
          retryable={false}
        />
      </div>
    );
  }

  return (
    <PortalNewClaimForm
      orders={orders.items}
      deliveries={deliveries.items}
    />
  );
}

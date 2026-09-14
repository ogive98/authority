import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
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
      <APageBody>
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
      </APageBody>
    );
  }

  return (
    <PortalNewClaimForm
      orders={orders.items}
      deliveries={deliveries.items}
    />
  );
}

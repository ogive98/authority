import { AErrorState } from "@/components/a/a-error-state";
import { PortalNewOrderForm } from "@/components/portal/portal-new-order-form";
import { fetchCatalog, fetchPortalMe } from "@/lib/customer-portal";

export default async function PortalNewOrderPage() {
  const [{ status: catStatus, data: catalog }, { data: me }] =
    await Promise.all([fetchCatalog({ limit: 100 }), fetchPortalMe()]);

  if (catStatus !== 200 || !catalog) {
    return (
      <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <AErrorState
          message={
            catStatus === 401 || catStatus === 403
              ? "Session portail expirée ou refusée."
              : "Impossible de charger le catalogue."
          }
          retryable={false}
        />
      </div>
    );
  }

  return (
    <PortalNewOrderForm
      catalog={catalog.items}
      blocked={me?.customer.blocked === true}
    />
  );
}

import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { PortalNewPaymentDeclarationForm } from "@/components/portal/portal-new-payment-declaration-form";
import { fetchPortalOpenItems } from "@/lib/customer-portal";

export default async function PortalNewPaymentDeclarationPage() {
  const { status, data } = await fetchPortalOpenItems({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <APageBody>
        <AErrorState
          message={
            status === 401 || status === 403
              ? "Session portail expirée ou refusée."
              : "Impossible de préparer le formulaire."
          }
          retryable={false}
        />
      </APageBody>
    );
  }

  return <PortalNewPaymentDeclarationForm openItems={data.items} />;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalInvoice,
  portalInvoiceBadgeTone,
  portalInvoiceStatusLabel,
  PORTAL_FINANCE_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data } = await fetchPortalInvoice(id);

  if (shouldHidePortal(status) || status === 404) {
    notFound();
  }

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Facture" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message="Impossible de charger cette facture."
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
        description={data.label ?? "Facture (lecture seule)"}
        actions={
          <Link
            href={PORTAL_FINANCE_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Finance
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <div className="flex flex-wrap items-center gap-3">
          <ABadge tone={portalInvoiceBadgeTone(data.status)}>
            {portalInvoiceStatusLabel(data.status)}
          </ABadge>
          <span className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
            {data.amountTotal} {data.currency}
          </span>
          {data.issuedAt ? (
            <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
              Émise {data.issuedAt.slice(0, 10)}
            </span>
          ) : null}
          {data.dueDate ? (
            <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
              Échéance {data.dueDate}
            </span>
          ) : null}
        </div>

        {data.openItemId ? (
          <p className="text-[length:var(--a-text-sm)]">
            <Link
              href={`${PORTAL_FINANCE_PATH}/${data.openItemId}`}
              className="text-a-accent hover:underline"
            >
              Voir la créance associée →
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

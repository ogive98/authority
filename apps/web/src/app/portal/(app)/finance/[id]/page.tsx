import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalOpenItem,
  portalOpenItemBadgeTone,
  portalOpenItemStatusLabel,
  PORTAL_FINANCE_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalFinanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data } = await fetchPortalOpenItem(id);

  if (shouldHidePortal(status) || status === 404) {
    notFound();
  }

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Créance" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message="Impossible de charger cette créance."
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
        description={data.label ?? "Créance AR (lecture seule)"}
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
          <ABadge tone={portalOpenItemBadgeTone(data.status)}>
            {portalOpenItemStatusLabel(data.status)}
          </ABadge>
          <span className="a-mono text-[length:var(--a-text-sm)] tabular-nums">
            Ouvert {data.amountOpen} / {data.amountTotal} {data.currency}
          </span>
          {data.dueDate ? (
            <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
              Échéance {data.dueDate}
            </span>
          ) : null}
        </div>

        <div className="a-card overflow-hidden">
          <div className="border-b border-a-border-subtle px-4 py-2 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            Encaissements
          </div>
          {data.allocations.length === 0 ? (
            <p className="px-4 py-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Aucun encaissement enregistré.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">Date</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {data.allocations.map((a, i) => (
                  <tr
                    key={`${a.paidAt}-${i}`}
                    className="border-t border-a-border-subtle"
                  >
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {a.paidAt.slice(0, 10)}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {a.amount} {data.currency}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {a.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

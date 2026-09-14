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
        <APageBody>
          <AErrorState
            message="Impossible de charger cette créance."
            retryable={false}
          />
        </APageBody>
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
      <APageBody>
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

        <section className="space-y-2">
          <h2 className="px-1 text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            Encaissements
          </h2>
          {data.allocations.length === 0 ? (
            <p className="a-underlay rounded-md px-4 py-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Aucun encaissement enregistré.
            </p>
          ) : (
            <ASoftTable>
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Date</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Note</th>
                </tr>
              </ASoftThead>
              <tbody>
                {data.allocations.map((a, i) => (
                  <ASoftTr key={`${a.paidAt}-${i}`}>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {a.paidAt.slice(0, 10)}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {a.amount} {data.currency}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {a.note ?? "—"}
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
        </section>
      </APageBody>
    </div>
  );
}

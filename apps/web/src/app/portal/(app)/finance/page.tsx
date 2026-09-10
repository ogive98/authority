import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalCredit,
  fetchPortalInvoices,
  fetchPortalOpenItems,
  portalInvoiceBadgeTone,
  portalInvoiceStatusLabel,
  portalOpenItemBadgeTone,
  portalOpenItemStatusLabel,
  PORTAL_FINANCE_INVOICES_PATH,
  PORTAL_FINANCE_PATH,
} from "@/lib/customer-portal";
import { softPageBody, softTile } from "@/lib/soft-glass-ui";

export default async function PortalFinancePage() {
  const [
    { status: creditStatus, data: credit },
    { status, data },
    { status: invoicesStatus, data: invoicesData },
  ] = await Promise.all([
    fetchPortalCredit(),
    fetchPortalOpenItems({ limit: 50 }),
    fetchPortalInvoices({ limit: 50 }),
  ]);

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Finance" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les créances."
            }
            retryable={false}
          />
        </div>
      </div>
    );
  }

  const items = data.items;
  const invoices =
    invoicesStatus === 200 && invoicesData ? invoicesData.items : [];
  const outstanding =
    creditStatus === 200 && credit
      ? `${credit.outstandingBalance} ${credit.currency}`
      : "—";
  const limit =
    creditStatus === 200 && credit?.creditLimit
      ? `${credit.creditLimit} ${credit.currency}`
      : "—";

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Finance"
        description="Factures émises · créances ouvertes · montants enregistrés (lecture seule — pas de TVA calculée)"
      />
      <div className={softPageBody}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={softTile}>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Solde ouvert
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums text-a-accent">
              {outstanding}
            </p>
          </div>
          <div className={softTile}>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Plafond crédit
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums">
              {limit}
            </p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            Factures
          </h2>
          {invoicesStatus !== 200 ? (
            <AErrorState
              message="Impossible de charger les factures."
              retryable={false}
            />
          ) : invoices.length === 0 ? (
            <AEmptyState
              title="Aucune facture"
              description="Les factures émises liées à votre compte apparaîtront ici."
              canAct={false}
            />
          ) : (
            <div className="a-underlay rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-[length:var(--a-text-sm)]">
                  <thead className="bg-a-surface-3/80 text-a-fg-muted">
                    <tr>
                      <th className="a-table-cell font-medium">N°</th>
                      <th className="a-table-cell font-medium">Libellé</th>
                      <th className="a-table-cell font-medium">Total</th>
                      <th className="a-table-cell font-medium">Statut</th>
                      <th className="a-table-cell font-medium">Émission</th>
                      <th className="a-table-cell font-medium">Échéance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-a-border-subtle transition-colors hover:bg-a-surface-3/50"
                      >
                        <td className="a-table-cell">
                          <Link
                            href={`${PORTAL_FINANCE_INVOICES_PATH}/${row.id}`}
                            className="a-mono font-medium text-a-accent hover:underline"
                          >
                            {row.number}
                          </Link>
                        </td>
                        <td className="a-table-cell text-a-fg-muted">
                          {row.label ?? "—"}
                        </td>
                        <td className="a-mono a-table-cell tabular-nums">
                          {row.amountTotal} {row.currency}
                        </td>
                        <td className="a-table-cell">
                          <ABadge tone={portalInvoiceBadgeTone(row.status)}>
                            {portalInvoiceStatusLabel(row.status)}
                          </ABadge>
                        </td>
                        <td className="a-mono a-table-cell text-a-fg-muted">
                          {row.issuedAt
                            ? row.issuedAt.slice(0, 10)
                            : "—"}
                        </td>
                        <td className="a-mono a-table-cell text-a-fg-muted">
                          {row.dueDate ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            Créances
          </h2>
          {items.length === 0 ? (
            <AEmptyState
              title="Aucune créance"
              description="Les créances ouvertes liées à votre compte apparaîtront ici."
              canAct={false}
            />
          ) : (
            <div className="a-underlay rounded-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-[length:var(--a-text-sm)]">
                  <thead className="bg-a-surface-3/80 text-a-fg-muted">
                    <tr>
                      <th className="a-table-cell font-medium">N°</th>
                      <th className="a-table-cell font-medium">Libellé</th>
                      <th className="a-table-cell font-medium">Total</th>
                      <th className="a-table-cell font-medium">Ouvert</th>
                      <th className="a-table-cell font-medium">Statut</th>
                      <th className="a-table-cell font-medium">Échéance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-a-border-subtle transition-colors hover:bg-a-surface-3/50"
                      >
                        <td className="a-table-cell">
                          <Link
                            href={`${PORTAL_FINANCE_PATH}/${row.id}`}
                            className="a-mono font-medium text-a-accent hover:underline"
                          >
                            {row.number}
                          </Link>
                        </td>
                        <td className="a-table-cell text-a-fg-muted">
                          {row.label ?? "—"}
                        </td>
                        <td className="a-mono a-table-cell tabular-nums">
                          {row.amountTotal} {row.currency}
                        </td>
                        <td className="a-mono a-table-cell tabular-nums font-medium">
                          {row.amountOpen} {row.currency}
                        </td>
                        <td className="a-table-cell">
                          <ABadge tone={portalOpenItemBadgeTone(row.status)}>
                            {portalOpenItemStatusLabel(row.status)}
                          </ABadge>
                        </td>
                        <td className="a-mono a-table-cell text-a-fg-muted">
                          {row.dueDate ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

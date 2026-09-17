import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { APageSection } from "@/components/a/a-page-section";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import {
  fetchPortalCredit,
  fetchPortalInvoices,
  fetchPortalOpenItems,
  fetchPortalPaymentDeclarations,
  portalInvoiceBadgeTone,
  portalInvoiceStatusLabel,
  portalOpenItemBadgeTone,
  portalOpenItemStatusLabel,
  portalPaymentDeclarationBadgeTone,
  portalPaymentDeclarationStatusLabel,
  portalPaymentMethodLabel,
  PORTAL_FINANCE_INVOICES_PATH,
  PORTAL_FINANCE_PATH,
  PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH,
} from "@/lib/customer-portal";
import { softTile } from "@/lib/d294-ui";

export default async function PortalFinancePage() {
  const [
    { status: creditStatus, data: credit },
    { status, data },
    { status: invoicesStatus, data: invoicesData },
    { status: declStatus, data: declData },
  ] = await Promise.all([
    fetchPortalCredit(),
    fetchPortalOpenItems({ limit: 50 }),
    fetchPortalInvoices({ limit: 50 }),
    fetchPortalPaymentDeclarations({ limit: 10 }),
  ]);

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Finance" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les créances."
            }
            retryable={false}
          />
        </APageBody>
      </>
    );
  }

  const items = data.items;
  const invoices =
    invoicesStatus === 200 && invoicesData ? invoicesData.items : [];
  const declarations =
    declStatus === 200 && declData ? declData.items : [];
  const outstanding =
    creditStatus === 200 && credit
      ? `${credit.outstandingBalance} ${credit.currency}`
      : "—";
  const limit =
    creditStatus === 200 && credit?.creditLimit
      ? `${credit.creditLimit} ${credit.currency}`
      : "—";

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title="Finance"
        description="Factures · créances · déclarations de paiement (signalement ADV — pas d’encaissement auto)"
        actions={
          <Link href={`${PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}/new`}>
            <AButton type="button">Déclarer un paiement</AButton>
          </Link>
        }
      />
      <APageBody>
        <APageSection bare>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={softTile}>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Solde ouvert
              </p>
              <p className="a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] font-medium text-a-accent">
                {outstanding}
              </p>
            </div>
            <div className={softTile}>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Plafond crédit
              </p>
              <p className="a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] font-medium">
                {limit}
              </p>
            </div>
          </div>
        </APageSection>

        <APageSection
          title="Déclarations de paiement"
          bare
          action={
            <Link
              href={PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}
              className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            >
              Voir tout
            </Link>
          }
        >
          {declStatus !== 200 ? (
            <AErrorState
              message="Impossible de charger les déclarations."
              retryable={false}
            />
          ) : declarations.length === 0 ? (
            <AEmptyState
              title="Aucune déclaration"
              description="Signalez un paiement déjà effectué pour informer l’ADV."
              canAct={false}
            />
          ) : (
            <ASoftTable className="min-w-[480px]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Mode</th>
                  <th className="a-table-cell font-medium">Statut</th>
                </tr>
              </ASoftThead>
              <tbody>
                {declarations.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-table-cell">
                      <Link
                        href={`${PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}/${row.id}`}
                        className="a-mono font-medium text-a-accent hover:underline"
                      >
                        {row.number}
                      </Link>
                    </td>
                    <td className="a-mono a-tabular a-table-cell">
                      {row.amount} {row.currency}
                    </td>
                    <td className="a-table-cell">
                      {portalPaymentMethodLabel(row.method)}
                    </td>
                    <td className="a-table-cell">
                      <ABadge
                        tone={portalPaymentDeclarationBadgeTone(row.status)}
                      >
                        {portalPaymentDeclarationStatusLabel(row.status)}
                      </ABadge>
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
        </APageSection>

        <APageSection title="Factures" bare>
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
            <ASoftTable className="min-w-[520px]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Total</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Émission</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                </tr>
              </ASoftThead>
              <tbody>
                {invoices.map((row) => (
                  <ASoftTr key={row.id}>
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
                    <td className="a-mono a-tabular a-table-cell">
                      {row.amountTotal} {row.currency}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={portalInvoiceBadgeTone(row.status)}>
                        {portalInvoiceStatusLabel(row.status)}
                      </ABadge>
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.issuedAt ? row.issuedAt.slice(0, 10) : "—"}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {row.dueDate ?? "—"}
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
        </APageSection>

        <APageSection title="Créances" bare>
          {items.length === 0 ? (
            <AEmptyState
              title="Aucune créance"
              description="Les créances ouvertes liées à votre compte apparaîtront ici."
              canAct={false}
            />
          ) : (
            <ASoftTable className="min-w-[560px]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Total</th>
                  <th className="a-table-cell font-medium">Ouvert</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                </tr>
              </ASoftThead>
              <tbody>
                {items.map((row) => (
                  <ASoftTr key={row.id}>
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
                    <td className="a-mono a-tabular a-table-cell">
                      {row.amountTotal} {row.currency}
                    </td>
                    <td className="a-mono a-tabular a-table-cell font-medium">
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
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
        </APageSection>
      </APageBody>
    </>
  );
}

import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import {
  PORTAL_FINANCE_PATH,
  PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH,
  fetchPortalPaymentDeclarations,
  portalPaymentDeclarationBadgeTone,
  portalPaymentDeclarationStatusLabel,
  portalPaymentMethodLabel,
} from "@/lib/customer-portal";

export default async function PortalPaymentDeclarationsPage() {
  const { status, data } = await fetchPortalPaymentDeclarations({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Déclarations" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les déclarations."
            }
            retryable={false}
          />
        </APageBody>
      </>
    );
  }

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title="Déclarations de paiement"
        description="Signalements soumis à l’ADV — sans encaissement automatique."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={PORTAL_FINANCE_PATH}
              className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
            >
              ← Finance
            </Link>
            <Link
              href={`${PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}/new`}
            >
              <AButton type="button">Déclarer</AButton>
            </Link>
          </div>
        }
      />
      <APageBody>
        {data.items.length === 0 ? (
          <AEmptyState
            title="Aucune déclaration"
            description="Signalez un paiement déjà effectué pour informer l’ADV."
            canAct={false}
          />
        ) : (
          <ASoftTable className="min-w-[560px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Montant</th>
                <th className="a-table-cell font-medium">Mode</th>
                <th className="a-table-cell font-medium">Date</th>
                <th className="a-table-cell font-medium">Statut</th>
              </tr>
            </ASoftThead>
            <tbody>
              {data.items.map((row) => (
                <ASoftTr key={row.id}>
                  <td className="a-table-cell">
                    <Link
                      href={`${PORTAL_FINANCE_PAYMENT_DECLARATIONS_PATH}/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                    >
                      {row.number}
                    </Link>
                  </td>
                  <td className="a-mono a-table-cell tabular-nums">
                    {row.amount} {row.currency}
                  </td>
                  <td className="a-table-cell">
                    {portalPaymentMethodLabel(row.method)}
                  </td>
                  <td className="a-mono a-table-cell text-a-fg-muted">
                    {row.paymentDate}
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
      </APageBody>
    </>
  );
}

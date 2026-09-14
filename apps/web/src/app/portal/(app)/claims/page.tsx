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
  fetchClaims,
  portalClaimBadgeTone,
  portalClaimStatusLabel,
  portalClaimTypeLabel,
  PORTAL_CLAIMS_PATH,
} from "@/lib/customer-portal";

export default async function PortalClaimsPage() {
  const { status, data } = await fetchClaims({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Réclamations" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les réclamations."
            }
            retryable={false}
          />
        </APageBody>
      </>
    );
  }

  const items = data.items;

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title="Réclamations"
        description={`${items.length} dossier${items.length === 1 ? "" : "s"} · pièces sur chaque détail`}
        actions={
          <Link href={`${PORTAL_CLAIMS_PATH}/new`}>
            <AButton type="button">Nouvelle réclamation</AButton>
          </Link>
        }
      />
      <APageBody>
        {items.length === 0 ? (
          <AEmptyState
            title="Aucune réclamation"
            description="Ouvrez un dossier lié à une commande ou livraison si besoin."
            canAct={false}
          />
        ) : (
          <ASoftTable className="min-w-[560px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Type</th>
                <th className="a-table-cell font-medium">Sujet</th>
                <th className="a-table-cell font-medium">Statut</th>
                <th className="a-table-cell font-medium">Créée</th>
              </tr>
            </ASoftThead>
            <tbody>
              {items.map((row) => (
                <ASoftTr key={row.id}>
                  <td className="a-table-cell">
                    <Link
                      href={`${PORTAL_CLAIMS_PATH}/${row.id}`}
                      className="a-mono font-medium text-a-accent hover:underline"
                    >
                      {row.number}
                    </Link>
                  </td>
                  <td className="a-table-cell">
                    {portalClaimTypeLabel(row.type)}
                  </td>
                  <td className="a-table-cell">{row.subject}</td>
                  <td className="a-table-cell">
                    <ABadge tone={portalClaimBadgeTone(row.status)}>
                      {portalClaimStatusLabel(row.status)}
                    </ABadge>
                  </td>
                  <td className="a-mono a-table-cell text-a-fg-muted">
                    {row.createdAt.slice(0, 10)}
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

import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
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
      <div>
        <AScreenHeader kicker="Customer Portal" title="Réclamations" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou refusée."
                : "Impossible de charger les réclamations."
            }
            retryable={false}
          />
        </div>
      </div>
    );
  }

  const items = data.items;

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Réclamations"
        description={`${items.length} dossier${items.length === 1 ? "" : "s"} · téléchargements Documents reportés`}
        actions={
          <Link
            href={`${PORTAL_CLAIMS_PATH}/new`}
            className="rounded-[var(--a-radius-sm)] bg-a-accent px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-white hover:bg-a-accent-hover"
          >
            Nouvelle réclamation
          </Link>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        {items.length === 0 ? (
          <AEmptyState
            title="Aucune réclamation"
            description="Ouvrez un dossier lié à une commande ou livraison si besoin."
            canAct={false}
          />
        ) : (
          <div className="a-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-[length:var(--a-text-sm)]">
                <thead className="bg-a-surface-3/80 text-a-fg-muted">
                  <tr>
                    <th className="a-table-cell font-medium">N°</th>
                    <th className="a-table-cell font-medium">Type</th>
                    <th className="a-table-cell font-medium">Sujet</th>
                    <th className="a-table-cell font-medium">Statut</th>
                    <th className="a-table-cell font-medium">Créée</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

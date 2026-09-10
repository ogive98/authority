import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalDocuments,
} from "@/lib/customer-portal";
import { PortalDocumentDownloadButton } from "@/components/portal/portal-document-download-button";

export default async function PortalDocumentsPage() {
  const { status, data } = await fetchPortalDocuments({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Documents" />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou module Documents indisponible."
                : "Impossible de charger les documents."
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
        title="Documents"
        description={`${items.length} fichier${items.length === 1 ? "" : "s"} partagé${items.length === 1 ? "" : "s"}`}
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        {items.length === 0 ? (
          <AEmptyState
            title="Aucun document"
            description="Les pièces partagées par votre ADV apparaîtront ici."
            canAct={false}
          />
        ) : (
          <div className="a-underlay rounded-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] border-collapse text-left text-[length:var(--a-text-sm)]">
                <thead className="bg-a-surface-3/80 text-a-fg-muted">
                  <tr>
                    <th className="a-table-cell font-medium">N°</th>
                    <th className="a-table-cell font-medium">Titre</th>
                    <th className="a-table-cell font-medium">Type</th>
                    <th className="a-table-cell font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-t border-a-border-subtle transition-colors hover:bg-a-surface-3/50"
                    >
                      <td className="a-mono a-table-cell">{row.number}</td>
                      <td className="a-table-cell">{row.title}</td>
                      <td className="a-table-cell">{row.mime}</td>
                      <td className="a-table-cell">
                        <PortalDocumentDownloadButton id={row.id} />
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

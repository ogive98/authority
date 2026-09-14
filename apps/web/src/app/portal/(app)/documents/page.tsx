import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import { fetchPortalDocuments } from "@/lib/customer-portal";
import { PortalDocumentDownloadButton } from "@/components/portal/portal-document-download-button";

export default async function PortalDocumentsPage() {
  const { status, data } = await fetchPortalDocuments({ limit: 50 });

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader kicker="Customer Portal" title="Documents" />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session portail expirée ou module Documents indisponible."
                : "Impossible de charger les documents."
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
        title="Documents"
        description={`${items.length} fichier${items.length === 1 ? "" : "s"} partagé${items.length === 1 ? "" : "s"}`}
      />
      <APageBody>
        {items.length === 0 ? (
          <AEmptyState
            title="Aucun document"
            description="Les pièces partagées par votre ADV apparaîtront ici."
            canAct={false}
          />
        ) : (
          <ASoftTable className="min-w-[480px]">
            <ASoftThead>
              <tr>
                <th className="a-table-cell font-medium">N°</th>
                <th className="a-table-cell font-medium">Titre</th>
                <th className="a-table-cell font-medium">Type</th>
                <th className="a-table-cell font-medium">Actions</th>
              </tr>
            </ASoftThead>
            <tbody>
              {items.map((row) => (
                <ASoftTr key={row.id}>
                  <td className="a-mono a-table-cell">{row.number}</td>
                  <td className="a-table-cell">{row.title}</td>
                  <td className="a-table-cell">{row.mime}</td>
                  <td className="a-table-cell">
                    <PortalDocumentDownloadButton id={row.id} />
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

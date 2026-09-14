import Link from "next/link";
import { notFound } from "next/navigation";
import { ABadge } from "@/components/a/a-badge";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a/a-soft-table";
import { PortalDocumentDownloadButton } from "@/components/portal/portal-document-download-button";
import { PortalClaimDocumentUpload } from "@/components/portal/portal-claim-document-upload";
import {
  fetchClaim,
  fetchPortalDocuments,
  portalClaimBadgeTone,
  portalClaimStatusLabel,
  portalClaimTypeLabel,
  PORTAL_CLAIMS_PATH,
  PORTAL_DELIVERIES_PATH,
  PORTAL_DOCUMENTS_PATH,
  PORTAL_ORDERS_PATH,
  shouldHidePortal,
} from "@/lib/customer-portal";

export default async function PortalClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { status, data } = await fetchClaim(id);

  if (shouldHidePortal(status) || status === 404) {
    notFound();
  }

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader kicker="Customer Portal" title="Réclamation" />
        <APageBody>
          <AErrorState
            message="Impossible de charger cette réclamation."
            retryable={false}
          />
        </APageBody>
      </div>
    );
  }

  const docsRes = await fetchPortalDocuments({
    linkType: "CLAIM",
    linkId: data.id,
    limit: 50,
  });
  const docs =
    docsRes.status === 200 && docsRes.data ? docsRes.data.items : [];

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title={data.number}
        description={data.subject}
        actions={
          <Link
            href={PORTAL_CLAIMS_PATH}
            className="text-[length:var(--a-text-sm)] text-a-accent hover:underline"
          >
            ← Réclamations
          </Link>
        }
      />
      <APageBody>
        <div className="flex flex-wrap items-center gap-3">
          <ABadge tone={portalClaimBadgeTone(data.status)}>
            {portalClaimStatusLabel(data.status)}
          </ABadge>
          <span className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            {portalClaimTypeLabel(data.type)}
          </span>
          <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
            {data.createdAt.slice(0, 10)}
          </span>
        </div>

        <div className="a-underlay space-y-3 rounded-md p-4">
          <p className="whitespace-pre-wrap text-[length:var(--a-text-sm)]">
            {data.description}
          </p>
          <div className="flex flex-wrap gap-4 text-[length:var(--a-text-sm)]">
            {data.orderId && data.orderNumber ? (
              <Link
                href={`${PORTAL_ORDERS_PATH}/${data.orderId}`}
                className="a-mono text-a-accent hover:underline"
              >
                Commande {data.orderNumber}
              </Link>
            ) : null}
            {data.shipmentId && data.shipmentNumber ? (
              <Link
                href={`${PORTAL_DELIVERIES_PATH}/${data.shipmentId}`}
                className="a-mono text-a-accent hover:underline"
              >
                Livraison {data.shipmentNumber}
              </Link>
            ) : null}
          </div>
          {data.resolutionNote ? (
            <p className="pt-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Résolution : {data.resolutionNote}
            </p>
          ) : null}
        </div>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
              Pièces jointes
            </h2>
            <Link
              href={PORTAL_DOCUMENTS_PATH}
              className="text-[length:var(--a-text-xs)] text-a-accent hover:underline"
            >
              Tous les documents →
            </Link>
          </div>
          {docsRes.status === 401 || docsRes.status === 403 ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Documents indisponibles pour cette session.
            </p>
          ) : docs.length === 0 ? (
            <AEmptyState
              title="Aucune pièce"
              description="Ajoutez une photo ou un PDF ci-dessous, ou attendez un partage ADV."
              canAct={false}
            />
          ) : (
            <ASoftTable>
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Titre</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </ASoftThead>
              <tbody>
                {docs.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">{row.number}</td>
                    <td className="a-table-cell">{row.title}</td>
                    <td className="a-table-cell">
                      <PortalDocumentDownloadButton id={row.id} />
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
          <PortalClaimDocumentUpload claimId={data.id} />
        </section>
      </APageBody>
    </div>
  );
}

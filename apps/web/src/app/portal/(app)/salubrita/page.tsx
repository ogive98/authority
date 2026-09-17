import Link from "next/link";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { APageBody } from "@/components/a/a-page-body";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalSalubritaHistory,
  PORTAL_SALUBRITA_PATH,
} from "@/lib/customer-portal";
import { softList, softListRow } from "@/lib/d294-ui";

function fmtFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default async function PortalSalubritaPage() {
  const { status, data } = await fetchPortalSalubritaHistory();

  if (status !== 200 || !data) {
    return (
      <>
        <AScreenHeader
          kicker="Customer Portal"
          title="Certificats de salubrité"
        />
        <APageBody>
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session expirée ou module Stock indisponible."
                : "Impossible de charger l’historique des certificats."
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
        title="Certificats de salubrité"
        description={`Historique ${data.days} j · consultation, impression, e-mail / WhatsApp`}
      />
      <APageBody>
        {items.length === 0 ? (
          <AEmptyState
            title="Aucun certificat"
            description="Les certificats des 30 derniers jours apparaîtront ici."
            canAct={false}
          />
        ) : (
          <ul className={softList}>
            {items.map((row) => (
              <li key={row.packDate}>
                <Link
                  href={`${PORTAL_SALUBRITA_PATH}/${row.packDate}`}
                  className={softListRow}
                >
                  <div className="min-w-0 flex-1">
                    <p className="a-mono text-[13px] font-semibold text-a-fg">
                      {fmtFr(row.packDate)}
                    </p>
                    <p className="text-[12px] text-a-fg-muted">
                      {row.lineCount > 0
                        ? `${row.lineCount} produit${row.lineCount > 1 ? "s" : ""}`
                        : "Voir le certificat"}
                    </p>
                  </div>
                  <span className="text-[13px] font-medium text-a-accent">
                    Ouvrir →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </APageBody>
    </>
  );
}

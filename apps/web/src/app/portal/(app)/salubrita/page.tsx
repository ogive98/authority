import Link from "next/link";
import { AEmptyState } from "@/components/a/a-empty-state";
import { AErrorState } from "@/components/a/a-error-state";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalSalubritaHistory,
  PORTAL_SALUBRITA_PATH,
} from "@/lib/customer-portal";

function fmtFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default async function PortalSalubritaPage() {
  const { status, data } = await fetchPortalSalubritaHistory();

  if (status !== 200 || !data) {
    return (
      <div>
        <AScreenHeader
          kicker="Portail client"
          title="Certificats de salubrité"
        />
        <div className="px-[var(--a-space-6)] py-[var(--a-space-5)]">
          <AErrorState
            message={
              status === 401 || status === 403
                ? "Session expirée ou module Stock indisponible."
                : "Impossible de charger l’historique des certificats."
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
        kicker="Portail client"
        title="Certificats de salubrité"
        description={`Historique ${data.days} j · consultation, impression, e-mail / WhatsApp`}
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        {items.length === 0 ? (
          <AEmptyState
            title="Aucun certificat"
            description="Les certificats des 30 derniers jours apparaîtront ici."
            canAct={false}
          />
        ) : (
          <ul className="space-y-1">
            {items.map((row) => (
              <li key={row.packDate}>
                <Link
                  href={`${PORTAL_SALUBRITA_PATH}/${row.packDate}`}
                  className="flex items-center justify-between rounded-[var(--a-radius-sm)] px-3 py-3 hover:bg-a-surface-3/70"
                >
                  <div>
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
      </div>
    </div>
  );
}

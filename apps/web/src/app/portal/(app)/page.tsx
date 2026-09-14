import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
import { AButton } from "@/components/a/a-button";
import { APageBody } from "@/components/a/a-page-body";
import { APageSection } from "@/components/a/a-page-section";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalDashboard,
  fetchPortalMe,
  PORTAL_CLAIMS_PATH,
  PORTAL_DELIVERIES_PATH,
  PORTAL_DOCUMENTS_PATH,
  PORTAL_FINANCE_PATH,
  PORTAL_ORDERS_NEW_PATH,
  PORTAL_ORDERS_PATH,
  portalInsightBadgeTone,
  portalInsightSeverityLabel,
  type PortalInsight,
} from "@/lib/customer-portal";
import { softGhostBtn, softTile } from "@/lib/soft-glass-ui";

function KpiTile({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="a-underlay a-action-quiet block space-y-1 rounded-[var(--a-radius-md)] px-4 py-3 transition-colors hover:bg-a-surface-3/60"
    >
      <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wide text-a-fg-muted">
        {label}
      </p>
      <p className="a-mono text-[length:var(--a-text-xl)] tabular-nums text-a-fg">
        {value}
      </p>
      {hint ? (
        <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">{hint}</p>
      ) : null}
    </Link>
  );
}

export default async function PortalDashboardPage() {
  const [{ data: me }, { data: dashboard }] = await Promise.all([
    fetchPortalMe(),
    fetchPortalDashboard(),
  ]);

  const openOrders = dashboard?.kpis.openOrders ?? 0;
  const pendingDeliveries = dashboard?.kpis.pendingDeliveries ?? 0;
  const openClaims = dashboard?.kpis.openClaims ?? 0;
  const outstanding = dashboard?.kpis.outstandingBalance;
  const insights = dashboard?.insights ?? [];
  const outstandingLabel =
    outstanding == null ? "—" : `${Number(outstanding).toFixed(3)} TND`;

  return (
    <>
      <AScreenHeader
        kicker="Customer Portal"
        title="Tableau de bord"
        description={
          me
            ? `${me.customer.legalName} · rôle ${me.membership.role}`
            : "Espace client"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={PORTAL_ORDERS_NEW_PATH}>
              <AButton type="button">Nouvelle commande</AButton>
            </Link>
            <Link href={`${PORTAL_CLAIMS_PATH}/new`} className={softGhostBtn}>
              Réclamation
            </Link>
          </div>
        }
      />
      <APageBody>
        <APageSection bare>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiTile
              href={PORTAL_ORDERS_PATH}
              label="Commandes ouvertes"
              value={String(openOrders)}
              hint="Voir / créer →"
            />
            <KpiTile
              href={PORTAL_DELIVERIES_PATH}
              label="Livraisons en cours"
              value={String(pendingDeliveries)}
              hint="Suivre →"
            />
            <KpiTile
              href={PORTAL_FINANCE_PATH}
              label="Solde"
              value={outstandingLabel}
              hint="Créances →"
            />
            <KpiTile
              href={PORTAL_CLAIMS_PATH}
              label="Réclamations ouvertes"
              value={String(openClaims)}
              hint="Voir / ouvrir →"
            />
            <KpiTile
              href={PORTAL_DOCUMENTS_PATH}
              label="Documents"
              value="Bibliothèque"
              hint="Pièces partagées →"
            />
          </div>
        </APageSection>

        <InsightsPanel insights={insights} />
      </APageBody>
    </>
  );
}

function InsightsPanel({ insights }: { insights: PortalInsight[] }) {
  if (insights.length === 0) {
    return (
      <APageSection title="Alertes">
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          Aucune alerte pour le moment.
        </p>
      </APageSection>
    );
  }

  return (
    <APageSection title="Alertes" bare>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li key={insight.id}>
            <Link
              href={insight.href}
              className={`flex items-start gap-3 ${softTile}`}
            >
              <ABadge tone={portalInsightBadgeTone(insight.severity)}>
                {portalInsightSeverityLabel(insight.severity)}
              </ABadge>
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  {insight.title}
                </p>
                <p className="mt-0.5 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  {insight.message}
                </p>
              </div>
              <span className="shrink-0 text-[length:var(--a-text-xs)] text-a-accent">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </APageSection>
  );
}

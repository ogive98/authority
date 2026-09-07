import Link from "next/link";
import { ABadge } from "@/components/a/a-badge";
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
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Tableau de bord"
        description={
          me
            ? `${me.customer.legalName} · rôle ${me.membership.role}`
            : "Espace client"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={PORTAL_ORDERS_NEW_PATH}
              className="rounded-[var(--a-radius-sm)] bg-a-accent px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-accent-fg hover:bg-a-accent-hover"
            >
              Nouvelle commande
            </Link>
            <Link
              href={`${PORTAL_CLAIMS_PATH}/new`}
              className="rounded-[var(--a-radius-sm)] border border-a-border-subtle bg-a-surface-2 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:bg-a-surface-3"
            >
              Réclamation
            </Link>
          </div>
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href={PORTAL_ORDERS_PATH}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Commandes ouvertes
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums text-a-accent">
              {openOrders}
            </p>
            <p className="mt-2 text-[length:var(--a-text-xs)] text-a-accent">
              Voir / créer →
            </p>
          </Link>
          <Link
            href={PORTAL_DELIVERIES_PATH}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Livraisons en cours
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums text-a-accent">
              {pendingDeliveries}
            </p>
            <p className="mt-2 text-[length:var(--a-text-xs)] text-a-accent">
              Suivre →
            </p>
          </Link>
          <Link
            href={PORTAL_FINANCE_PATH}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Solde
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums text-a-accent">
              {outstandingLabel}
            </p>
            <p className="mt-2 text-[length:var(--a-text-xs)] text-a-accent">
              Créances →
            </p>
          </Link>
          <Link
            href={PORTAL_CLAIMS_PATH}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Réclamations ouvertes
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums text-a-accent">
              {openClaims}
            </p>
            <p className="mt-2 text-[length:var(--a-text-xs)] text-a-accent">
              Voir / ouvrir →
            </p>
          </Link>
          <Link
            href={PORTAL_DOCUMENTS_PATH}
            className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
          >
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Documents
            </p>
            <p className="mt-1 text-[length:var(--a-text-lg)] font-medium text-a-accent">
              Bibliothèque
            </p>
            <p className="mt-2 text-[length:var(--a-text-xs)] text-a-accent">
              Pièces partagées →
            </p>
          </Link>
        </div>

        <InsightsPanel insights={insights} />
      </div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: PortalInsight[] }) {
  if (insights.length === 0) {
    return (
      <section className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3">
        <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
          Alertes
        </h2>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          Aucune alerte pour le moment.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
        Alertes
      </h2>
      <ul className="space-y-2">
        {insights.map((insight) => (
          <li key={insight.id}>
            <Link
              href={insight.href}
              className="flex items-start gap-3 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3 transition-colors hover:border-a-accent/40 hover:bg-a-accent-muted/40"
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
    </section>
  );
}

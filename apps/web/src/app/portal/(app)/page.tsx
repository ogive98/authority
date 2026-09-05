import Link from "next/link";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalDashboard,
  fetchPortalMe,
  PORTAL_DELIVERIES_PATH,
  PORTAL_FINANCE_PATH,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalDashboardPage() {
  const [{ data: me }, { data: dashboard }] = await Promise.all([
    fetchPortalMe(),
    fetchPortalDashboard(),
  ]);

  const message =
    dashboard?.message ?? "Portal P4 — finance read + delivery track";
  const openOrders = dashboard?.kpis.openOrders ?? 0;
  const pendingDeliveries = dashboard?.kpis.pendingDeliveries ?? 0;
  const outstanding = dashboard?.kpis.outstandingBalance;
  const outstandingLabel =
    outstanding == null
      ? "—"
      : `${Number(outstanding).toFixed(3)} TND`;

  return (
    <div>
      <AScreenHeader
        kicker="Customer Portal"
        title="Tableau de bord"
        description={
          me
            ? `${me.customer.legalName} · rôle ${me.membership.role}`
            : message
        }
      />
      <div className="space-y-[var(--a-space-5)] px-[var(--a-space-6)] py-[var(--a-space-5)]">
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">{message}</p>
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
      </div>
    </div>
  );
}

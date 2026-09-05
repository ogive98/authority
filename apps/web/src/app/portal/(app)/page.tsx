import Link from "next/link";
import { AScreenHeader } from "@/components/a/a-screen-header";
import {
  fetchPortalDashboard,
  fetchPortalMe,
  PORTAL_ORDERS_PATH,
} from "@/lib/customer-portal";

export default async function PortalDashboardPage() {
  const [{ data: me }, { data: dashboard }] = await Promise.all([
    fetchPortalMe(),
    fetchPortalDashboard(),
  ]);

  const message =
    dashboard?.message ?? "Portal P3 — order create / reorder";
  const openOrders = dashboard?.kpis.openOrders ?? 0;

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
          <div className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3">
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Livraisons en cours
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums">
              {dashboard?.kpis.pendingDeliveries ?? 0}
            </p>
          </div>
          <div className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3">
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              Solde
            </p>
            <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums">
              {dashboard?.kpis.outstandingBalance ?? "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

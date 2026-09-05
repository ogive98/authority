import { AScreenHeader } from "@/components/a/a-screen-header";
import { fetchPortalDashboard, fetchPortalMe } from "@/lib/customer-portal";

export default async function PortalDashboardPage() {
  const [{ data: me }, { data: dashboard }] = await Promise.all([
    fetchPortalMe(),
    fetchPortalDashboard(),
  ]);

  const sections = dashboard?.sections ?? ["orders", "deliveries", "finance"];
  const message = dashboard?.message ?? "Portal P1 — dashboard shell";

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
          {(
            [
              {
                label: "Commandes ouvertes",
                value: dashboard?.kpis.openOrders ?? 0,
              },
              {
                label: "Livraisons en cours",
                value: dashboard?.kpis.pendingDeliveries ?? 0,
              },
              {
                label: "Solde",
                value: dashboard?.kpis.outstandingBalance ?? "—",
              },
            ] as const
          ).map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-4 py-3"
            >
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                {kpi.label}
              </p>
              <p className="a-mono mt-1 text-[length:var(--a-text-lg)] font-medium tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
        <ul className="space-y-2">
          {sections.map((section) => (
            <li
              key={section}
              className="rounded-[var(--a-radius-md)] border border-dashed border-a-border-subtle px-4 py-3 text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Section « {section} » — bientôt (P2+)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { AScreenHeader } from "@/components/a";
import { fetchSuperAdminHealth } from "@/lib/super-admin-health";

export default async function SuperAdminHomePage() {
  const { data } = await fetchSuperAdminHealth();

  return (
    <>
      <AScreenHeader
        kicker="Control Center"
        title="Plateforme"
        description="Santé, licence, files — chrome UI-14, pas le tableau de bord métier."
      />
      <div className="space-y-[var(--a-space-6)] p-[var(--a-space-6)]">
        <section className="a-card space-y-2 p-[var(--a-space-5)]">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">Health</h2>
          <dl className="a-mono grid gap-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            <div className="flex justify-between gap-4">
              <dt>status</dt>
              <dd className="text-a-fg">{data?.status ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>realm</dt>
              <dd className="text-a-fg">{data?.realm ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>timestamp</dt>
              <dd className="text-a-fg">{data?.timestamp ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}

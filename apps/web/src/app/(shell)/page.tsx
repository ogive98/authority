import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-[var(--a-space-6)] p-[var(--a-space-6)]">
      <div>
        <h1
          className="text-[length:var(--a-text-2xl)] font-semibold"
          style={{ letterSpacing: "var(--a-tracking-title)" }}
        >
          Tableau de bord
        </h1>
        <p className="mt-1 max-w-xl text-[length:var(--a-text-sm)] text-a-fg-muted">
          Nav depuis <span className="a-mono">/api/v1/me/registry</span> —
          modules ENABLED seulement. Gate flag :{" "}
          <Link href="/dev/registry" className="text-a-accent hover:underline">
            /dev/registry
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="a-card p-[var(--a-space-4)]">
          <h2 className="text-[length:var(--a-text-md)] font-medium">
            Navigation
          </h2>
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            Icônes seules → survol étend le label → clic ouvre le menu
            fonctionnalités.
          </p>
        </article>
        <article className="a-card p-[var(--a-space-4)]">
          <h2 className="text-[length:var(--a-text-md)] font-medium">Gates</h2>
          <ul className="mt-2 space-y-1 text-[length:var(--a-text-sm)]">
            <li>
              <Link href="/dev/tokens" className="text-a-accent hover:underline">
                /dev/tokens
              </Link>
            </li>
            <li>
              <Link
                href="/dev/primitives"
                className="text-a-accent hover:underline"
              >
                /dev/primitives
              </Link>
            </li>
            <li>
              <Link
                href="/dev/states"
                className="text-a-accent hover:underline"
              >
                /dev/states
              </Link>
            </li>
            <li>
              <Link
                href="/dev/datatable"
                className="text-a-accent hover:underline"
              >
                /dev/datatable
              </Link>
            </li>
          </ul>
        </article>
        <article className="a-card p-[var(--a-space-4)]">
          <h2 className="text-[length:var(--a-text-md)] font-medium">
            Notifications
          </h2>
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            L’icône cloche = alertes / événements (SSE plus tard, UI-09). Pas
            un décor.
          </p>
        </article>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-[var(--a-space-6)]">
      <p className="a-mono text-[length:var(--a-text-sm)] uppercase tracking-widest text-a-accent">
        UI-01
      </p>
      <h1
        className="mt-4 text-[length:var(--a-text-2xl)] font-semibold tracking-tight"
        style={{ letterSpacing: "var(--a-tracking-title)" }}
      >
        AUTHORITY
      </h1>
      <p className="mt-3 max-w-md text-center text-[length:var(--a-text-md)] text-a-fg-muted">
        Tokens + typographie IBM Plex. Shell dynamique et modules métier
        arrivent ensuite.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/dev/tokens"
          className="rounded-[var(--a-radius-md)] bg-a-accent px-4 py-2 text-[length:var(--a-text-sm)] font-medium text-a-accent-fg hover:bg-a-accent-hover"
        >
          Voir /dev/tokens
        </Link>
        <a
          className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle hover:text-a-accent"
          href="http://localhost:3001/health/live"
          target="_blank"
          rel="noreferrer"
        >
          API /health/live
        </a>
      </div>
    </main>
  );
}

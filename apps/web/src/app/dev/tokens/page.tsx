import Link from "next/link";
import { ThemeToggle } from "@/components/shell";

export const metadata = {
  title: "Tokens — AUTHORITY UI-01",
  description: "Design tokens dark + light — mini-shell gate",
};

const NAV = [
  { label: "Tokens", active: true },
  { label: "Surfaces", active: false },
  { label: "Typo", active: false },
  { label: "Sémantique", active: false },
] as const;

const SURFACES = [
  { key: "1", role: "Canvas" },
  { key: "2", role: "Card" },
  { key: "3", role: "Raised" },
  { key: "4", role: "Hover" },
  { key: "5", role: "Highest" },
] as const;

const SEMANTIC = [
  { key: "accent", fg: "accent-fg", label: "Accent" },
  { key: "success", fg: "success-fg", label: "Success" },
  { key: "warning", fg: "warning-fg", label: "Warning" },
  { key: "danger", fg: "danger-fg", label: "Danger" },
  { key: "info", fg: "info-fg", label: "Info" },
  { key: "spectre", fg: "spectre-fg", label: "SPECTRE" },
] as const;

const TEXT = ["xs", "sm", "md", "lg", "xl", "2xl"] as const;
const SPACES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const RADII = ["sm", "md", "lg"] as const;

function KpiCard({
  label,
  value,
  delta,
  deltaTone,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: "success" | "warning" | "danger";
}) {
  const tone =
    deltaTone === "success"
      ? "var(--a-success)"
      : deltaTone === "warning"
        ? "var(--a-warning)"
        : "var(--a-danger)";

  return (
    <article className="a-card p-[var(--a-space-5)]">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center border text-[length:var(--a-text-xs)] text-a-fg-muted"
          style={{
            borderColor: "var(--a-border-subtle)",
            background: "var(--a-surface-3)",
            borderRadius: "var(--a-radius-sm)",
          }}
          aria-hidden
        >
          ·
        </div>
        <span
          className="a-mono text-[length:var(--a-text-xs)] font-medium"
          style={{ color: tone }}
        >
          {delta}
        </span>
      </div>
      <p className="mt-4 text-[length:var(--a-text-sm)] text-a-fg-muted">{label}</p>
      <p className="a-mono a-tabular mt-1 text-[length:var(--a-text-2xl)] font-semibold tracking-tight">
        {value}
      </p>
    </article>
  );
}

export default function DevTokensPage() {
  return (
    <div className="flex min-h-screen bg-a-surface-1 text-a-fg">
      {/* Sidebar */}
      <aside
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-a-border-subtle bg-a-surface-1 md:flex"
        style={{ width: "var(--a-sidebar-width)" }}
      >
        <div className="flex items-center gap-3 px-[var(--a-space-5)] py-[var(--a-space-5)]">
          <div
            className="flex h-8 w-8 items-center justify-center border text-[length:var(--a-text-sm)] font-semibold"
            style={{
              borderColor: "var(--a-border-strong)",
              background: "var(--a-surface-2)",
              color: "var(--a-fg)",
              borderRadius: "var(--a-radius-sm)",
            }}
          >
            A
          </div>
          <div>
            <p className="text-[length:var(--a-text-md)] font-semibold tracking-tight">
              AUTHORITY
            </p>
            <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
              UI-01 · tokens
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-[var(--a-space-3)] py-[var(--a-space-2)]">
          {NAV.map((item) => (
            <div
              key={item.label}
              className="relative flex items-center gap-3 rounded-[var(--a-radius-md)] px-3 py-2.5 text-[length:var(--a-text-sm)]"
              style={
                item.active
                  ? {
                      background: "var(--a-surface-3)",
                      color: "var(--a-fg)",
                    }
                  : { color: "var(--a-fg-muted)" }
              }
            >
              {item.active ? (
                <span
                  className="absolute top-1/2 left-0 h-4 w-px -translate-y-1/2"
                  style={{ background: "var(--a-accent)" }}
                  aria-hidden
                />
              ) : null}
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: item.active
                    ? "var(--a-accent)"
                    : "var(--a-fg-subtle)",
                }}
                aria-hidden
              />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-a-border-subtle p-[var(--a-space-4)]">
          <div className="a-lightning rounded-[var(--a-radius-md)] p-3">
            <p className="text-[length:var(--a-text-sm)] font-medium">Lightning</p>
            <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
              Blur faible — interdit TND / stock / DLC
            </p>
          </div>
          <Link
            href="/"
            className="block text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
          >
            ← Accueil
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[var(--a-z-sticky)] flex items-center justify-between gap-4 border-b border-a-border-subtle bg-a-surface-1/90 px-[var(--a-space-6)] py-[var(--a-space-4)] backdrop-blur-md">
          <div>
            <h1
              className="text-[length:var(--a-text-xl)] font-semibold"
              style={{ letterSpacing: "var(--a-tracking-title)" }}
            >
              Design tokens
            </h1>
            <p className="mt-0.5 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Plex · teal sobre · minimal · gate Dark / Light
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              className="hidden rounded-[var(--a-radius-md)] px-4 py-2 text-[length:var(--a-text-sm)] font-medium sm:inline-flex"
              style={{
                background: "var(--a-accent)",
                color: "var(--a-accent-fg)",
              }}
            >
              Valider UI-01
            </button>
          </div>
        </header>

        <main className="flex-1 space-y-[var(--a-space-6)] px-[var(--a-space-6)] py-[var(--a-space-6)]">
          {/* KPI strip — comfort sample */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Chiffre d’affaires"
              value="124 560,00 TND"
              delta="+12,4 %"
              deltaTone="success"
            />
            <KpiCard
              label="Stock fromage"
              value="12 450,000 kg"
              delta="−2,1 %"
              deltaTone="warning"
            />
            <KpiCard
              label="Lots ouverts"
              value="42"
              delta="+3"
              deltaTone="success"
            />
            <KpiCard
              label="DLC < 7 j"
              value="8"
              delta="critique"
              deltaTone="danger"
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-5">
            {/* Surfaces ladder */}
            <section className="a-card space-y-4 p-[var(--a-space-5)] lg:col-span-3">
              <div>
                <h2 className="text-[length:var(--a-text-lg)] font-semibold">
                  Surfaces
                </h2>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Échelle canvas → highest — contraste lisible entre étapes
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-5">
                {SURFACES.map((s) => (
                  <div
                    key={s.key}
                    className="flex min-h-24 flex-col justify-between rounded-[var(--a-radius-md)] border p-3"
                    style={{
                      background: `var(--a-surface-${s.key})`,
                      borderColor: "var(--a-border-subtle)",
                    }}
                  >
                    <span className="text-[length:var(--a-text-sm)] font-medium">
                      {s.role}
                    </span>
                    <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      surface-{s.key}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Accent + SPECTRE */}
            <section className="a-card space-y-4 p-[var(--a-space-5)] lg:col-span-2">
              <div>
                <h2 className="text-[length:var(--a-text-lg)] font-semibold">
                  Accent & SPECTRE
                </h2>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Teal sobre (D016) · tint ops
                </p>
              </div>
              <button
                type="button"
                className="w-full rounded-[var(--a-radius-md)] px-4 py-3 text-left font-medium"
                style={{
                  background: "var(--a-accent)",
                  color: "var(--a-accent-fg)",
                }}
              >
                Primary CTA
                <span className="mt-1 block a-mono text-[length:var(--a-text-xs)] opacity-80">
                  --a-accent → hover --a-accent-hover
                </span>
              </button>
              <div
                className="rounded-[var(--a-radius-md)] border p-4"
                style={{
                  background: "var(--a-spectre-muted)",
                  borderColor: "var(--a-spectre)",
                  color: "var(--a-spectre-fg)",
                }}
              >
                <p className="font-medium">SPECTRE MODE</p>
                <p className="mt-1 text-[length:var(--a-text-xs)] opacity-80">
                  Teinte froide — pas de néon
                </p>
              </div>
              <button
                type="button"
                className="w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-3 px-4 py-3 text-left"
              >
                Focus-visible (Tab)
                <span className="mt-1 block a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                  --a-focus-ring
                </span>
              </button>
            </section>
          </div>

          {/* Semantic + typo */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="a-card space-y-4 p-[var(--a-space-5)]">
              <div>
                <h2 className="text-[length:var(--a-text-lg)] font-semibold">
                  Sémantique
                </h2>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Badges statut — lisibles sur canvas sombre
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {SEMANTIC.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-[var(--a-radius-md)] px-3 py-3"
                    style={{
                      background: `var(--a-${s.key})`,
                      color: `var(--a-${s.fg})`,
                    }}
                  >
                    <p className="text-[length:var(--a-text-sm)] font-medium">
                      {s.label}
                    </p>
                    <p className="a-mono mt-1 text-[length:var(--a-text-xs)] opacity-80">
                      --a-{s.key}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="a-card space-y-4 p-[var(--a-space-5)]">
              <div>
                <h2 className="text-[length:var(--a-text-lg)] font-semibold">
                  Typographie
                </h2>
                <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                  IBM Plex Sans + Mono · tabular nums
                </p>
              </div>
              <div className="space-y-1">
                {TEXT.map((t) => (
                  <p
                    key={t}
                    className="flex items-baseline justify-between gap-4 border-b border-a-border-subtle py-1.5 last:border-0"
                    style={{ fontSize: `var(--a-text-${t})` }}
                  >
                    <span>Fromagerie ADV</span>
                    <span className="a-mono shrink-0 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      text-{t}
                    </span>
                  </p>
                ))}
              </div>
              <div className="rounded-[var(--a-radius-md)] bg-a-surface-3 p-4">
                <p className="a-mono a-tabular text-[length:var(--a-text-xl)] font-medium">
                  1 234,560 TND
                </p>
                <p className="a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] text-a-fg-muted">
                  12 450,000 kg
                </p>
                <p className="a-mono mt-3 text-[length:var(--a-text-sm)] text-a-fg-subtle">
                  LOT-2026-0042 · SKU-BRIE-250
                </p>
              </div>
            </section>
          </div>

          {/* Spacing + radius */}
          <section className="a-card space-y-5 p-[var(--a-space-5)]">
            <div>
              <h2 className="text-[length:var(--a-text-lg)] font-semibold">
                Spacing & radius
              </h2>
              <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
                Gutters · coins 2 / 4 / 6 (minimal)
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              {SPACES.map((n) => (
                <div key={n} className="flex flex-col items-center gap-2">
                  <div
                    style={{
                      width: `var(--a-space-${n})`,
                      height: `var(--a-space-${n})`,
                      background: "var(--a-accent)",
                      borderRadius: "var(--a-radius-sm)",
                    }}
                  />
                  <span className="a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {n}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4">
              {RADII.map((r) => (
                <div
                  key={r}
                  className="flex h-16 w-28 items-center justify-center border border-a-border-strong bg-a-surface-3"
                  style={{ borderRadius: `var(--a-radius-${r})` }}
                >
                  <span className="a-mono text-[length:var(--a-text-xs)]">
                    radius-{r}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

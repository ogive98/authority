"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { tipsForPage } from "@/lib/tips-catalog";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useShellStore } from "@/stores/shell-store";
import { cn } from "@/lib/utils";
import {
  personalityForFeature,
  resolveFeatureIcon,
} from "./icon-personality";

function featureHint(href: string): string {
  try {
    const u = new URL(href, "http://authority.local");
    const path = u.pathname.replace(/^\//, "").replace(/\//g, " · ");
    const tab = u.searchParams.get("tab");
    if (tab) return path ? `${path} · ${tab}` : tab;
    return path || "Accueil";
  } catch {
    return href.replace(/^\//, "").replace(/\//g, " · ") || "Accueil";
  }
}

function SoftRing({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 a-glow-pulse" aria-hidden>
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        className="text-a-surface-4"
      />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 40 40)"
        className="text-a-accent"
      />
    </svg>
  );
}

/**
 * Soft Glass feature list — full (D160) or embedded column for Mission Control (D161).
 */
export function ModuleFeatureList({
  moduleKey,
  className,
  variant = "full",
}: {
  moduleKey?: string;
  className?: string;
  /** `embedded` = dense list only (Mission Control right column). */
  variant?: "full" | "embedded";
}) {
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry } = useMeRegistry();
  const key = moduleKey ?? selectedModuleId;
  const mod =
    registry.modules.find((m) => m.key === key) ?? registry.modules[0];

  const tip = tipsForPage("/", key, 1)[0] ?? null;
  const features = mod?.features ?? [];
  const moduleCount = registry.modules.length;
  const embedded = variant === "embedded";

  if (!mod) {
    return (
      <p className="p-6 text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
        Aucun module.
      </p>
    );
  }

  const featureList = (
    <div className="min-h-0 flex-1 overflow-auto pr-1">
      {features.length === 0 ? (
        <p className="a-underlay rounded-[var(--a-radius-lg)] px-4 py-10 text-center text-[length:var(--a-text-sm)] text-a-fg-muted">
          Aucune fonctionnalité pour ce module.
        </p>
      ) : (
        <ul className="space-y-2">
          {features.map((f, i) => {
            const Icon = resolveFeatureIcon(f.id, f.label);
            const p = personalityForFeature(f.id, f.label);
            return (
              <li
                key={f.id}
                className="a-stagger-in"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <Link
                  href={f.href}
                  className={cn(
                    "group a-underlay flex items-center gap-3 rounded-[var(--a-radius-md)] px-3.5 py-3",
                    "transition-all duration-200 hover:bg-a-surface-3 hover:translate-x-0.5",
                    embedded && "py-2.5",
                  )}
                >
                  <span
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded-[var(--a-radius-sm)] bg-a-accent-muted",
                      embedded ? "h-9 w-9" : "h-10 w-10",
                      p.colorClass,
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--a-text-md)] font-semibold tracking-[-0.02em] text-a-fg">
                      {f.label}
                    </span>
                    <span className="a-mono mt-0.5 block truncate text-[11px] text-a-fg-subtle">
                      {featureHint(f.href)}
                    </span>
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-a-fg-subtle transition-transform duration-200 group-hover:translate-x-1 group-hover:text-a-accent"
                    strokeWidth={2}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (embedded) {
    return (
      <section
        className={cn("flex h-full min-h-0 w-full flex-col p-3 md:p-4", className)}
        aria-label={mod.name}
      >
        <header className="mb-3 shrink-0">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-[length:var(--a-text-lg)] font-bold tracking-[var(--a-tracking-title)] text-a-fg">
              {mod.name}
            </h2>
            <p className="a-mono text-[length:var(--a-text-xs)] text-a-fg-muted">
              {features.length}
            </p>
          </div>
        </header>
        {featureList}
      </section>
    );
  }

  return (
    <section
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      aria-label={mod.name}
    >
      <div className="mx-auto grid h-full min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-5 pb-5 pt-4 md:grid-cols-[minmax(0,1fr)_16rem] md:px-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-0 flex-col">
          <header className="mb-4 shrink-0 a-stagger-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-a-fg-subtle">
              Module
            </p>
            <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[length:var(--a-text-xl)] font-bold tracking-[var(--a-tracking-title)] text-a-fg">
                {mod.name}
              </h2>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {features.length}{" "}
                {features.length === 1 ? "fonctionnalité" : "fonctionnalités"}
              </p>
            </div>
          </header>

          {featureList}

          <footer className="mt-4 shrink-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                ["/account", "Mon compte"],
                ["/settings", "Préférences"],
                ["/help", "Aide"],
              ].map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  className="a-underlay rounded-[var(--a-radius-md)] px-3 py-2 text-[length:var(--a-text-sm)] font-medium text-a-fg transition-colors hover:bg-a-surface-3"
                >
                  {label}
                </Link>
              ))}
            </div>
            {tip ? (
              <aside className="a-underlay rounded-[var(--a-radius-md)] px-4 py-3">
                <p className="text-[length:var(--a-text-sm)] leading-relaxed text-a-fg-muted">
                  <span className="font-semibold text-a-fg">{tip.title}</span>
                  {" — "}
                  {tip.body.length > 140
                    ? `${tip.body.slice(0, 137)}…`
                    : tip.body}
                </p>
              </aside>
            ) : null}
          </footer>
        </div>

        <aside className="hidden min-h-0 flex-col gap-3 md:flex">
          <div className="a-underlay a-stagger-in flex flex-col items-center gap-2 rounded-[var(--a-radius-lg)] px-4 py-5">
            <SoftRing value={Math.min(100, Math.max(12, features.length * 12))} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-a-fg-subtle">
              Features registry
            </p>
            <p className="a-mono text-[length:var(--a-text-lg)] font-bold text-a-fg">
              {features.length}
            </p>
          </div>

          <div
            className="a-underlay a-stagger-in rounded-[var(--a-radius-lg)] px-4 py-4"
            style={{ animationDelay: "80ms" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-a-fg-subtle">
              Shell
            </p>
            <p className="mt-2 a-mono text-[length:var(--a-text-xl)] font-bold tracking-tight text-a-fg">
              {moduleCount}
            </p>
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              modules actifs
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** @deprecated alias — D159/D160 */
export const ModuleAppsGrid = ModuleFeatureList;

"use client";

import { useEffect, useState } from "react";
import { AButton, AScreenHeader, ASwitch } from "@/components/a";
import { cn } from "@/lib/utils";

type Tab = "general" | "apparence" | "notifications";
type Density = "comfortable" | "compact";

const DENSITY_KEY = "authority-density";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("apparence");
  const [density, setDensity] = useState<Density>("comfortable");
  const [jobAlerts, setJobAlerts] = useState(true);
  const [sseBanner, setSseBanner] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(DENSITY_KEY);
    if (stored === "compact" || stored === "comfortable") {
      setDensity(stored);
      document.documentElement.setAttribute("data-density", stored);
    }
  }, []);

  function applyDensity(next: Density) {
    setDensity(next);
    localStorage.setItem(DENSITY_KEY, next);
    document.documentElement.setAttribute("data-density", next);
  }

  return (
    <>
      <AScreenHeader
        title="Préférences"
        description="Apparence du poste — une préférence n’outrepasse jamais une permission."
        actions={
          <AButton type="button" size="sm">
            Enregistrer
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap gap-1 border-b border-a-border-subtle">
          {(
            [
              ["general", "Général"],
              ["apparence", "Apparence"],
              ["notifications", "Notifications"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 px-3 py-2 text-[length:var(--a-text-sm)]",
                tab === id
                  ? "border-a-accent text-a-fg"
                  : "border-transparent text-a-fg-muted hover:text-a-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "general" ? (
          <section className="a-card max-w-xl space-y-4 p-[var(--a-space-5)]">
            <h2 className="text-[length:var(--a-text-md)] font-medium">
              Contexte
            </h2>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-[length:var(--a-text-sm)]">
              <dt className="text-a-fg-muted">Société</dt>
              <dd>Fromagerie ADV</dd>
              <dt className="text-a-fg-muted">Site</dt>
              <dd>Sfax</dd>
              <dt className="text-a-fg-muted">Fuseau</dt>
              <dd className="a-mono">Africa/Tunis</dd>
              <dt className="text-a-fg-muted">Devise</dt>
              <dd className="a-mono">TND</dd>
            </dl>
            <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
              Langue UI = Phase 2 (C14). Pas de globe ici.
            </p>
          </section>
        ) : null}

        {tab === "apparence" ? (
          <section className="a-card max-w-xl space-y-5 p-[var(--a-space-5)]">
            <div>
              <p className="text-[length:var(--a-text-sm)] font-medium">
                Thème
              </p>
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Dark et light sont tous deux de première classe — switch dans le
                header (même contrôle que le shell).
              </p>
            </div>
            <div>
              <p className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Densité
              </p>
              <div className="flex gap-2">
                <AButton
                  type="button"
                  size="sm"
                  variant={density === "comfortable" ? "primary" : "secondary"}
                  onClick={() => applyDensity("comfortable")}
                >
                  Confortable
                </AButton>
                <AButton
                  type="button"
                  size="sm"
                  variant={density === "compact" ? "primary" : "secondary"}
                  onClick={() => applyDensity("compact")}
                >
                  Compact
                </AButton>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "notifications" ? (
          <section className="a-card max-w-xl space-y-4 p-[var(--a-space-5)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[length:var(--a-text-sm)] font-medium">
                  Alertes jobs
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Shed P4 et files Thunder.
                </p>
              </div>
              <ASwitch
                label="Alertes jobs"
                checked={jobAlerts}
                onCheckedChange={setJobAlerts}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[length:var(--a-text-sm)] font-medium">
                  Bannière SSE
                </p>
                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Afficher « flux temps réel coupé ».
                </p>
              </div>
              <ASwitch
                label="Bannière SSE"
                checked={sseBanner}
                onCheckedChange={setSseBanner}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

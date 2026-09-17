"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import { fetchAnalyticsSummary, type AnalyticsSummary } from "@/lib/analytics";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: AnalyticsSummary }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function formatTnd(raw: string): string {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString("fr-TN", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export default function AnalyticsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchAnalyticsSummary();
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", data: res.data });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <AScreenHeader
        kicker="Analytics"
        title="Synthèse live"
        description="Agrégats réels Sales / Finance / Stock / Livraison — pas de KPI inventés (D293)."
        primary={
          <AButton type="button" size="sm" onClick={() => void load()}>
            Actualiser
          </AButton>
        }
      />

      <APageBody>
        {state.kind === "loading" ? (
          <ASkeleton className="h-48 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {state.kind === "ok" ? (
          <div className="flex flex-col gap-6">
            <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {state.data.note} · asOf{" "}
              <span className="a-mono">
                {new Date(state.data.asOf).toLocaleString("fr-TN")}
              </span>
            </p>

            {!state.data.sales &&
            !state.data.finance &&
            !state.data.inventory &&
            !state.data.delivery ? (
              <AEmptyState
                title="Aucun module source actif"
                description="Activez Ventes, Finance, Stock ou Livraison pour peupler la synthèse."
              />
            ) : null}

            {state.data.sales ? (
              <APageSection title="Ventes">
                <div className="flex flex-wrap gap-3">
                  <Stat
                    label="Brouillons"
                    value={String(state.data.sales.draftCount)}
                    href="/sales"
                  />
                  <Stat
                    label="Confirmées"
                    value={String(state.data.sales.confirmedCount)}
                    href="/sales"
                  />
                </div>
              </APageSection>
            ) : (
              <ModuleOff label="Ventes" />
            )}

            {state.data.finance ? (
              <APageSection title="Finance AR">
                <div className="flex flex-wrap gap-3">
                  <Stat
                    label="Créances ouvertes"
                    value={String(state.data.finance.openCount)}
                    href="/finance"
                  />
                  <Stat
                    label="Échues"
                    value={String(state.data.finance.overdueCount)}
                    href="/finance"
                  />
                  <Stat
                    label="Encours TND"
                    value={formatTnd(state.data.finance.outstandingOpen)}
                    href="/finance"
                    mono
                  />
                </div>
              </APageSection>
            ) : (
              <ModuleOff label="Finance" />
            )}

            {state.data.inventory ? (
              <APageSection title="Stock">
                <div className="flex flex-wrap gap-3">
                  <Stat
                    label="Lignes solde"
                    value={String(state.data.inventory.balanceLines)}
                    href="/inventory"
                  />
                  <Stat
                    label="Avec stock"
                    value={String(
                      state.data.inventory.positiveAvailableLines,
                    )}
                    href="/inventory"
                  />
                  <Stat
                    label="Lots ouverts"
                    value={String(state.data.inventory.openLots)}
                    href="/inventory/lots"
                  />
                </div>
              </APageSection>
            ) : (
              <ModuleOff label="Stock" />
            )}

            {state.data.delivery ? (
              <APageSection title="Livraison">
                <div className="flex flex-wrap gap-3">
                  <Stat
                    label="READY"
                    value={String(state.data.delivery.readyCount)}
                    href="/delivery"
                  />
                  <Stat
                    label="ASSIGNED"
                    value={String(state.data.delivery.assignedCount)}
                    href="/delivery"
                  />
                  <Stat
                    label="OUT"
                    value={String(state.data.delivery.outCount)}
                    href="/delivery"
                  />
                </div>
              </APageSection>
            ) : (
              <ModuleOff label="Livraison" />
            )}
          </div>
        ) : null}
      </APageBody>
    </>
  );
}

function ModuleOff({ label }: { label: string }) {
  return (
    <div className="a-card flex items-center gap-2 rounded-[var(--a-radius-md)] px-3 py-2">
      <ABadge tone="neutral">{label}</ABadge>
      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        Module désactivé — agrégat masqué
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string;
  href: string;
  mono?: boolean;
}) {
  return (
    <Link
      href={href}
      className="a-card min-w-[140px] rounded-[var(--a-radius-md)] px-3 py-3 transition-colors hover:bg-a-surface-3/50"
    >
      <p className="text-[length:var(--a-text-xs)] font-medium text-a-fg-muted">
        {label}
      </p>
      <p
        className={
          mono
            ? "a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] font-medium"
            : "a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] font-medium"
        }
      >
        {value}
      </p>
    </Link>
  );
}

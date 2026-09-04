"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AButton,
  ADecimalField,
  ADevPage,
  AKpiCard,
  ASensitiveValue,
} from "@/components/a";
import { useMeFieldAcl } from "@/hooks/use-me-field-acl";
import {
  FIELD_ACL_WAGE_KEY,
  FIELD_ACL_WAGE_PERMISSION,
  isFieldVisible,
} from "@/lib/field-acl";

const WAGE_DEMO = "2 450,000 TND";
const CA_DEMO = "21 459,560 TND";

type PreviewMode = "live" | "deny" | "allow";

export default function DevFieldAclPage() {
  const { data, isFetching, isError, dataUpdatedAt } = useMeFieldAcl();
  const qc = useQueryClient();
  const [mode, setMode] = useState<PreviewMode>("live");

  const liveWage = isFieldVisible(data, FIELD_ACL_WAGE_KEY);
  const wageVisible = mode === "live" ? liveWage : mode === "allow";

  const statusLabel = useMemo(() => {
    if (mode === "deny") return "simulé : sans grant";
    if (mode === "allow") return "simulé : avec grant";
    if (isFetching) return "live…";
    if (isError) return "live indisponible → fail-closed";
    return liveWage ? "live : visible" : "live : masqué";
  }, [mode, isFetching, isError, liveWage]);

  return (
    <ADevPage
      kicker="UI-11 · Role-based chrome"
      title="Field ACL"
      description="L’UI masque ; le serveur refuse. Densité tables = /settings (data-density). SPECTRE n’ouvre aucun champ."
      extraActions={
        <AButton
          size="sm"
          variant="secondary"
          onClick={() =>
            void qc.invalidateQueries({ queryKey: ["me-field-acl"] })
          }
        >
          Refetch
        </AButton>
      }
      mainClassName="mx-auto max-w-3xl space-y-[var(--a-space-7)] px-[var(--a-space-6)] py-[var(--a-space-7)]"
    >
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Gate : champ salaire masqué sans{" "}
        <span className="a-mono">{FIELD_ACL_WAGE_PERMISSION}</span>. API down /
        hors session → fail-closed. Les montants sans ACL (CA) restent visibles.
      </p>

      <div className="a-card space-y-2 p-[var(--a-space-4)] text-[length:var(--a-text-sm)]">
        <p>
          ACL : <span className="a-mono">{statusLabel}</span>
        </p>
        <p className="a-mono text-a-fg-subtle">
          companyId: {data.companyId ?? "null"} · updated{" "}
          {dataUpdatedAt
            ? new Date(dataUpdatedAt).toLocaleTimeString()
            : "—"}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <AButton
            type="button"
            size="sm"
            variant={mode === "live" ? "primary" : "secondary"}
            onClick={() => setMode("live")}
          >
            Live
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant={mode === "deny" ? "primary" : "secondary"}
            onClick={() => setMode("deny")}
          >
            Simuler sans grant
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant={mode === "allow" ? "primary" : "secondary"}
            onClick={() => setMode("allow")}
          >
            Simuler avec grant
          </AButton>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <AKpiCard
          label="Salaire brut"
          value={wageVisible ? WAGE_DEMO : ""}
          masked={!wageVisible}
        />
        <AKpiCard label="Chiffre d’affaires" value={CA_DEMO} delta="sans ACL" />
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">
          Fiche (affichage)
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Salaire
            </dt>
            <dd className="mt-1 text-[length:var(--a-text-lg)] font-semibold">
              <ASensitiveValue
                label="Salaire"
                value={WAGE_DEMO}
                visible={wageVisible}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Montant commande
            </dt>
            <dd className="a-mono a-tabular mt-1 text-[length:var(--a-text-lg)] font-semibold">
              {CA_DEMO}
            </dd>
          </div>
        </dl>
      </section>

      <section className="a-card space-y-4 p-[var(--a-space-5)]">
        <h2 className="text-[length:var(--a-text-lg)] font-medium">
          Saisie décimale
        </h2>
        {wageVisible ? (
          <ADecimalField
            key="wage-open"
            label="Salaire brut"
            unit="TND"
            defaultValue="2450.000"
          />
        ) : (
          <ADecimalField
            key="wage-masked"
            label="Salaire brut"
            unit="TND"
            disabled
            readOnly
            value="••••"
            aria-label="Salaire brut masqué"
          />
        )}
        <ADecimalField
          label="Montant commande (pas d’ACL)"
          unit="TND"
          defaultValue="21459.560"
        />
      </section>
    </ADevPage>
  );
}

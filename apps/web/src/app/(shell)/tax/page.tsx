"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
} from "@/components/a";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import {
  fetchExpertiseCatalog,
  type ExpertiseSlot,
} from "@/lib/settings";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: TaxCode[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const CALC_SLOT_KEYS = [
  "tax.vat",
  "tax.fodec",
  "tax.timbre",
  "tax.ras",
  "tax.tej",
] as const;

const CALC_ROWS: {
  key: (typeof CALC_SLOT_KEYS)[number];
  step: string;
  formula: string;
  applies: string;
}[] = [
  {
    key: "tax.vat",
    step: "TVA",
    formula: "HT × taux code TVA (Tax Engine)",
    applies: "Factures AR / avoirs",
  },
  {
    key: "tax.fodec",
    step: "FODEC",
    formula: "HT × rateBps Prefs (si VALIDATED)",
    applies: "Factures AR / avoirs",
  },
  {
    key: "tax.timbre",
    step: "Timbre",
    formula: "amountMilli Prefs (si VALIDATED)",
    applies: "Factures AR / avoirs",
  },
  {
    key: "tax.ras",
    step: "RAS",
    formula: "Base × rateBps Prefs (si VALIDATED) — indicatif AP",
    applies: "Décaissements AP (non déduit auto)",
  },
  {
    key: "tax.tej",
    step: "TEJ",
    formula: "Params déclaration Prefs (si VALIDATED)",
    applies: "Local only — pas de transmission API",
  },
];

function statusTone(
  status: ExpertiseSlot["status"],
): "success" | "warning" | "neutral" {
  if (status === "VALIDATED") return "success";
  if (status === "PENDING_EXPERT") return "warning";
  return "neutral";
}

function statusLabel(status: ExpertiseSlot["status"]): string {
  if (status === "VALIDATED") return "VALIDATED";
  if (status === "PENDING_EXPERT") return "En attente expert";
  return status;
}

export default function TaxCatalogPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [expertise, setExpertise] = useState<ExpertiseSlot[] | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchTaxCodes();
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", items: res.data.items });
  }, []);

  const loadExpertise = useCallback(async () => {
    const res = await fetchExpertiseCatalog();
    if (!res.ok) {
      setExpertise([]);
      return;
    }
    const wanted = new Set<string>(CALC_SLOT_KEYS);
    setExpertise(res.data.items.filter((i) => wanted.has(i.key)));
  }, []);

  useEffect(() => {
    void load();
    void loadExpertise();
  }, [load, loadExpertise]);

  const byKey = new Map((expertise ?? []).map((s) => [s.key, s]));

  return (
    <>
      <AScreenHeader
        kicker="Fiscalité"
        title="Fiscalité Tunisie"
        description="TVA (Tax Engine) + FODEC / timbre / RAS / TEJ via Préférences Expertise — consumers seulement si VALIDATED. Jamais de taux inventé."
        more={
          <AOverflowMenu
            items={[
              {
                id: "prefs",
                label: "Préférences Expertise",
                onSelect: () => router.push("/settings#expertise"),
              },
              {
                id: "invoices",
                label: "Factures clients",
                onSelect: () => router.push("/finance/invoices"),
              },
              {
                id: "ap",
                label: "Factures fournisseurs",
                onSelect: () => router.push("/finance/ap-bills"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <ExpertiseHintsStrip
          keys={[
            "tax.fodec",
            "tax.timbre",
            "tax.ras",
            "tax.tej",
          ]}
        />

        <APageSection
          title="Calcul général"
          description="Pile fiscale AUTHORITY — chaque ligne hors TVA lit Prefs Expertise. PENDING = montant 0 / indicatif off. TEJ = params locaux uniquement (pas de transmission)."
          bare
        >
          {expertise === null ? (
            <ASkeleton className="h-32 w-full" />
          ) : (
            <ASoftTable className="min-w-[44rem]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Étape</th>
                  <th className="a-table-cell font-medium">Formule</th>
                  <th className="a-table-cell font-medium">Statut Prefs</th>
                  <th className="a-table-cell font-medium">Valeur</th>
                  <th className="a-table-cell font-medium">Conso</th>
                </tr>
              </ASoftThead>
              <tbody>
                <ASoftTr>
                  <td className="a-table-cell font-medium">HT</td>
                  <td className="a-table-cell text-a-fg-muted">
                    Σ lignes (qty × PU HT)
                  </td>
                  <td className="a-table-cell">
                    <ABadge tone="neutral">Base</ABadge>
                  </td>
                  <td className="a-table-cell text-a-fg-muted">—</td>
                  <td className="a-table-cell text-a-fg-muted">AR / AP</td>
                </ASoftTr>
                {CALC_ROWS.map((row) => {
                  const slot = byKey.get(row.key);
                  return (
                    <ASoftTr key={row.key}>
                      <td className="a-table-cell font-medium">{row.step}</td>
                      <td className="a-table-cell text-a-fg-muted">
                        {row.formula}
                      </td>
                      <td className="a-table-cell">
                        {slot ? (
                          <ABadge tone={statusTone(slot.status)}>
                            {statusLabel(slot.status)}
                          </ABadge>
                        ) : (
                          <ABadge tone="warning">En attente expert</ABadge>
                        )}
                      </td>
                      <td className="a-mono a-table-cell tabular-nums">
                        {slot?.valueSummary ?? "—"}
                        {slot?.lawRef ? (
                          <span className="ml-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                            · {slot.lawRef}
                          </span>
                        ) : null}
                      </td>
                      <td className="a-table-cell text-a-fg-muted">
                        {row.applies}
                      </td>
                    </ASoftTr>
                  );
                })}
                <ASoftTr>
                  <td className="a-table-cell font-medium">TTC</td>
                  <td className="a-table-cell text-a-fg-muted">
                    HT + TVA + FODEC + timbre (AR)
                  </td>
                  <td className="a-table-cell">
                    <ABadge tone="accent">Résultat</ABadge>
                  </td>
                  <td className="a-table-cell text-a-fg-muted">—</td>
                  <td className="a-table-cell text-a-fg-muted">Factures AR</td>
                </ASoftTr>
              </tbody>
            </ASoftTable>
          )}
          <p className="mt-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Saisie / validation des barèmes :{" "}
            <Link
              href="/settings#expertise"
              className="text-a-accent hover:underline"
            >
              Préférences › Expertise légale
            </Link>
            {" "}
            (siège unique — D098 / D246).
          </p>
        </APageSection>

        {state.kind === "loading" ? <ASkeleton className="h-40" /> : null}
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
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun code TVA"
            description="Exécutez le seed pour charger le catalogue Tunisie."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <APageSection
            title="Catalogue codes TVA"
            description="Taux as-recorded — consommés par Finance et Ventes. FODEC / timbre / RAS / TEJ ne sont pas dans ce catalogue : Prefs Expertise."
            bare
          >
            <ASoftTable className="min-w-[40rem]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Code</th>
                  <th className="a-table-cell font-medium">Libellé</th>
                  <th className="a-table-cell font-medium">Taux</th>
                  <th className="a-table-cell font-medium">Réf. légale</th>
                  <th className="a-table-cell font-medium">Type</th>
                </tr>
              </ASoftThead>
              <tbody>
                {state.items.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-mono a-table-cell">{row.code}</td>
                    <td className="a-table-cell">{row.label}</td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {formatRateBps(row.currentRateBps)}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.lawRef ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone="accent">{row.kind}</ABadge>
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          </APageSection>
        ) : null}
      </APageBody>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
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
import {
  downloadTejXml,
  fetchTaxCodes,
  fetchTejExport,
  fetchTejExports,
  formatRateBps,
  generateTejExport,
  type TaxCode,
  type TejExport,
} from "@/lib/tax";
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
    formula: "Base × rateBps Prefs (si VALIDATED) — déduit net AP",
    applies: "Décaissements AP (D264)",
  },
  {
    key: "tax.tej",
    step: "TEJ",
    formula: "Brouillon XML local + SHA-256 (Prefs VALIDATED)",
    applies: "Local only — transmission DISABLED",
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
  const [tejItems, setTejItems] = useState<TejExport[] | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [tejBusy, setTejBusy] = useState(false);
  const [tejError, setTejError] = useState<string | null>(null);

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

  const loadTej = useCallback(async () => {
    const res = await fetchTejExports();
    if (!res.ok) {
      setTejItems([]);
      return;
    }
    setTejItems(res.data.items);
  }, []);

  useEffect(() => {
    void load();
    void loadExpertise();
    void loadTej();
  }, [load, loadExpertise, loadTej]);

  const byKey = new Map((expertise ?? []).map((s) => [s.key, s]));
  const tejSlot = byKey.get("tax.tej");
  const tejReady = tejSlot?.status === "VALIDATED";

  async function onGenerateTej() {
    setTejError(null);
    setTejBusy(true);
    try {
      const res = await generateTejExport(periodLabel.trim());
      if (!res.ok) {
        setTejError(res.message);
        return;
      }
      downloadTejXml(res.data);
      setPeriodLabel("");
      await loadTej();
    } finally {
      setTejBusy(false);
    }
  }

  async function onDownloadTej(id: string) {
    setTejError(null);
    const res = await fetchTejExport(id);
    if (!res.ok) {
      setTejError(res.message);
      return;
    }
    downloadTejXml(res.data);
  }

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
          description="Pile fiscale AUTHORITY — chaque ligne hors TVA lit Prefs Expertise. PENDING = montant 0 / indicatif off. TEJ = brouillon local uniquement (transmission DISABLED)."
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

        <APageSection
          title="TEJ — brouillon local"
          description="Génère un XML draft AUTHORITY (non officiel) + historique SHA-256. Jamais d’envoi API. Prefs tax.tej VALIDATED obligatoire."
          bare
          action={
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Période
                </span>
                <AInput
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="2026-Q3"
                  className="w-40"
                  disabled={tejBusy || !tejReady}
                />
              </label>
              <AButton
                type="button"
                size="sm"
                disabled={tejBusy || !tejReady || !periodLabel.trim()}
                onClick={() => void onGenerateTej()}
              >
                Générer brouillon
              </AButton>
            </div>
          }
        >
          {!tejReady ? (
            <p className="mb-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
              Validez d’abord{" "}
              <Link
                href="/settings#expertise"
                className="text-a-accent hover:underline"
              >
                tax.tej
              </Link>{" "}
              dans Préférences Expertise — aucun paramètre inventé.
            </p>
          ) : null}
          {tejError ? (
            <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
              {tejError}
            </p>
          ) : null}
          <p className="mb-3 text-[length:var(--a-text-xs)] text-a-fg-muted">
            Transmission :{" "}
            <ABadge tone="warning">DISABLED</ABadge>
            {" · "}schéma officiel XSD non fourni — brouillon local seulement.
          </p>
          {tejItems === null ? (
            <ASkeleton className="h-24 w-full" />
          ) : tejItems.length === 0 ? (
            <AEmptyState
              title="Aucun brouillon TEJ"
              description="Générez un export local après validation Prefs tax.tej."
            />
          ) : (
            <ASoftTable className="min-w-[40rem]">
              <ASoftThead>
                <tr>
                  <th className="a-table-cell font-medium">Période</th>
                  <th className="a-table-cell font-medium">SHA-256</th>
                  <th className="a-table-cell font-medium">Prefs</th>
                  <th className="a-table-cell font-medium">Créé</th>
                  <th className="a-table-cell font-medium">Action</th>
                </tr>
              </ASoftThead>
              <tbody>
                {tejItems.map((row) => (
                  <ASoftTr key={row.id}>
                    <td className="a-table-cell font-medium">
                      {row.periodLabel}
                    </td>
                    <td className="a-mono a-table-cell text-[length:var(--a-text-xs)]">
                      {row.contentSha256.slice(0, 16)}…
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {row.prefsValueLabel}
                    </td>
                    <td className="a-table-cell text-a-fg-muted">
                      {new Date(row.createdAt).toLocaleString("fr-TN")}
                    </td>
                    <td className="a-table-cell">
                      <button
                        type="button"
                        className="text-a-accent underline-offset-2 hover:underline"
                        onClick={() => void onDownloadTej(row.id)}
                      >
                        Télécharger XML
                      </button>
                    </td>
                  </ASoftTr>
                ))}
              </tbody>
            </ASoftTable>
          )}
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

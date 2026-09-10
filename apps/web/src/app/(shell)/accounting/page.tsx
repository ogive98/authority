"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  fetchAccounts,
  fetchEntries,
  fetchGlMapping,
  fetchJournals,
  fetchPeriods,
  fetchTrialBalance,
  GL_MAPPING_DEFAULTS,
  GL_MAPPING_KEYS,
  postEntry,
  type AccAccount,
  type AccJournal,
  type AccJournalEntry,
  type AccPeriod,
  type TrialBalanceRow,
} from "@/lib/accounting";
import { putCompanySetting } from "@/lib/settings";
import {
  softChipClass,
  softPageBody,
  softPanel,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";
import { cn } from "@/lib/utils";

type Tab = "coa" | "trial" | "entries" | "mapping";

type GlMapForm = {
  ar: string;
  bank: string;
  revenue: string;
  salesJournal: string;
  bankJournal: string;
};

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ok";
      accounts: AccAccount[];
      journals: AccJournal[];
      periods: AccPeriod[];
      trial: TrialBalanceRow[];
      entries: AccJournalEntry[];
      periodId: string;
      mapping: GlMapForm;
    }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function entryTone(
  status: string,
): "success" | "warning" | "neutral" | "danger" {
  if (status === "POSTED") return "success";
  if (status === "DRAFT") return "warning";
  if (status === "REVERSED") return "danger";
  return "neutral";
}

export default function AccountingPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("coa");
  const [mapDraft, setMapDraft] = useState<GlMapForm | null>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [postBusy, setPostBusy] = useState<string | null>(null);

  const load = useCallback(async (periodId?: string) => {
    setState({ kind: "loading" });
    const [acc, per, jou, mapRes] = await Promise.all([
      fetchAccounts(),
      fetchPeriods(),
      fetchJournals(),
      fetchGlMapping(),
    ]);
    if (!acc.ok) {
      if (acc.status === 403) {
        setState({ kind: "forbidden", message: acc.message });
        return;
      }
      setState({ kind: "error", message: acc.message });
      return;
    }
    if (!per.ok) {
      setState({ kind: "error", message: per.message });
      return;
    }
    const journals = jou.ok ? jou.data.items : [];
    const selected =
      periodId ||
      per.data.items.find((p) => p.status === "OPEN")?.id ||
      per.data.items[0]?.id ||
      "";

    const mapping: GlMapForm = mapRes.ok
      ? { ...mapRes.data.codes }
      : { ...GL_MAPPING_DEFAULTS };

    let trial: TrialBalanceRow[] = [];
    let entries: AccJournalEntry[] = [];
    if (selected) {
      const [tb, en] = await Promise.all([
        fetchTrialBalance(selected),
        fetchEntries({ periodId: selected, limit: 50 }),
      ]);
      if (tb.ok) trial = tb.data.items;
      if (en.ok) entries = en.data.items;
    } else {
      const en = await fetchEntries({ limit: 50 });
      if (en.ok) entries = en.data.items;
    }

    setMapDraft(mapping);
    setState({
      kind: "ok",
      accounts: acc.data.items,
      journals,
      periods: per.data.items,
      trial,
      entries,
      periodId: selected,
      mapping,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accountOptions = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.accounts.filter((a) => a.active);
  }, [state]);

  const journalOptions = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.journals.filter((j) => j.active);
  }, [state]);

  async function saveMapping() {
    if (!mapDraft) return;
    setMapBusy(true);
    setMapMsg(null);
    const pairs: [string, string][] = [
      [GL_MAPPING_KEYS.ar, mapDraft.ar],
      [GL_MAPPING_KEYS.bank, mapDraft.bank],
      [GL_MAPPING_KEYS.revenue, mapDraft.revenue],
      [GL_MAPPING_KEYS.salesJournal, mapDraft.salesJournal],
      [GL_MAPPING_KEYS.bankJournal, mapDraft.bankJournal],
    ];
    for (const [key, value] of pairs) {
      const r = await putCompanySetting(key, value.trim());
      if (!r.ok) {
        setMapMsg(r.message);
        setMapBusy(false);
        return;
      }
    }
    setMapMsg("Mapping enregistré — applicable aux prochains ponts Finance→GL.");
    setMapBusy(false);
    void load(state.kind === "ok" ? state.periodId : undefined);
  }

  async function onPost(id: string) {
    setPostBusy(id);
    const r = await postEntry(id);
    setPostBusy(null);
    if (!r.ok) {
      setMapMsg(r.message);
      return;
    }
    void load(state.kind === "ok" ? state.periodId : undefined);
  }

  return (
    <>
      <AScreenHeader
        kicker="Comptabilité"
        title="Grand livre"
        description="Plan comptable, écritures, balance et mapping Finance→GL — débit = crédit ; aucun taux inventé."
      />
      <div className={softPageBody}>
        {state.kind === "loading" ? (
          <ASkeleton className="h-32 w-full" />
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
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["coa", "Plan comptable"],
                  ["trial", "Balance"],
                  ["entries", "Écritures"],
                  ["mapping", "Mapping GL"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={softChipClass(tab === id)}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {mapMsg ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {mapMsg}
              </p>
            ) : null}

            {tab === "coa" ? (
              <section className="space-y-2">
                {state.accounts.length === 0 ? (
                  <AEmptyState
                    title="Aucun compte"
                    description="Les comptes seed apparaissent après seed."
                  />
                ) : (
                  <div className={softTableWrap}>
                    <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                      <thead className={softThead}>
                        <tr>
                          <th className="a-table-cell font-medium">Code</th>
                          <th className="a-table-cell font-medium">Nom</th>
                          <th className="a-table-cell font-medium">Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.accounts.map((a) => (
                          <tr key={a.id} className={softTr}>
                            <td className="a-mono a-table-cell">{a.code}</td>
                            <td className="a-table-cell">{a.name}</td>
                            <td className="a-table-cell">
                              <ABadge tone="neutral">{a.type}</ABadge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {tab === "trial" ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Période
                    <select
                      className={cn(softSelect, "mt-1 w-auto min-w-[12rem]")}
                      value={state.periodId}
                      onChange={(e) => void load(e.target.value)}
                    >
                      {state.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} ({p.status})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {state.trial.length === 0 ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucune écriture POSTED pour cette période.
                  </p>
                ) : (
                  <div className={softTableWrap}>
                    <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                      <thead className={softThead}>
                        <tr>
                          <th className="a-table-cell font-medium">Compte</th>
                          <th className="a-table-cell font-medium text-right">
                            Débit
                          </th>
                          <th className="a-table-cell font-medium text-right">
                            Crédit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.trial.map((r) => (
                          <tr key={r.accountId} className={softTr}>
                            <td className="a-table-cell">
                              <span className="a-mono">{r.accountCode}</span>{" "}
                              {r.accountName}
                            </td>
                            <td className="a-mono a-table-cell text-right tabular-nums">
                              {r.debit}
                            </td>
                            <td className="a-mono a-table-cell text-right tabular-nums">
                              {r.credit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {tab === "entries" ? (
              <section className="space-y-2">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Période
                    <select
                      className={cn(softSelect, "mt-1 w-auto min-w-[12rem]")}
                      value={state.periodId}
                      onChange={(e) => void load(e.target.value)}
                    >
                      {state.periods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} ({p.status})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {state.entries.length === 0 ? (
                  <AEmptyState
                    title="Aucune écriture"
                    description="Les ponts Finance→GL et les brouillons apparaîtront ici."
                  />
                ) : (
                  <div className={softTableWrap}>
                    <table className="w-full border-collapse text-left text-[length:var(--a-text-sm)]">
                      <thead className={softThead}>
                        <tr>
                          <th className="a-table-cell font-medium">N°</th>
                          <th className="a-table-cell font-medium">Date</th>
                          <th className="a-table-cell font-medium">Journal</th>
                          <th className="a-table-cell font-medium">Statut</th>
                          <th className="a-table-cell font-medium">Source</th>
                          <th className="a-table-cell font-medium text-right">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.entries.map((e) => (
                          <tr key={e.id} className={softTr}>
                            <td className="a-mono a-table-cell">{e.number}</td>
                            <td className="a-mono a-table-cell">
                              {e.entryDate}
                            </td>
                            <td className="a-mono a-table-cell">
                              {e.journalCode ?? "—"}
                            </td>
                            <td className="a-table-cell">
                              <ABadge tone={entryTone(e.status)}>
                                {e.status}
                              </ABadge>
                            </td>
                            <td className="a-mono a-table-cell text-a-fg-muted">
                              {e.sourceType ?? "—"}
                            </td>
                            <td className="a-table-cell text-right">
                              {e.status === "DRAFT" ? (
                                <AButton
                                  type="button"
                                  size="sm"
                                  disabled={postBusy === e.id}
                                  onClick={() => void onPost(e.id)}
                                >
                                  {postBusy === e.id ? "…" : "Poster"}
                                </AButton>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {tab === "mapping" && mapDraft ? (
              <section className={softPanel}>
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Codes de comptes et journaux utilisés par le pont
                  Finance→GL. Saisie société — pas de taux fiscaux.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["ar", "Clients (AR)", "account"],
                      ["bank", "Banque", "account"],
                      ["revenue", "Ventes / produits", "account"],
                      ["salesJournal", "Journal ventes", "journal"],
                      ["bankJournal", "Journal banque", "journal"],
                    ] as const
                  ).map(([field, label, kind]) => (
                    <label
                      key={field}
                      className="block text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      {label}
                      <select
                        className={cn(softSelect, "mt-1")}
                        value={mapDraft[field]}
                        onChange={(e) =>
                          setMapDraft((d) =>
                            d ? { ...d, [field]: e.target.value } : d,
                          )
                        }
                      >
                        {kind === "account"
                          ? accountOptions.map((a) => (
                              <option key={a.id} value={a.code}>
                                {a.code} — {a.name}
                              </option>
                            ))
                          : journalOptions.map((j) => (
                              <option key={j.id} value={j.code}>
                                {j.code} — {j.name}
                              </option>
                            ))}
                        {!accountOptions.some(
                          (a) => a.code === mapDraft[field],
                        ) &&
                        kind === "account" ? (
                          <option value={mapDraft[field]}>
                            {mapDraft[field]} (non trouvé)
                          </option>
                        ) : null}
                        {kind === "journal" &&
                        !journalOptions.some(
                          (j) => j.code === mapDraft[field],
                        ) ? (
                          <option value={mapDraft[field]}>
                            {mapDraft[field]} (non trouvé)
                          </option>
                        ) : null}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <AButton
                    type="button"
                    size="sm"
                    disabled={mapBusy}
                    onClick={() => void saveMapping()}
                  >
                    {mapBusy ? "Enregistrement…" : "Enregistrer"}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={mapBusy}
                    onClick={() => setMapDraft(state.mapping)}
                  >
                    Réinitialiser
                  </AButton>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  );
}

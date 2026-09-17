"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AListUtilities,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ATabs,
  erpListDescription,
} from "@/components/a";
import {
  ENTRY_STATUS_FILTERS,
  entryBadgeTone,
  fetchAccounts,
  fetchEntries,
  fetchGlMapping,
  fetchJournals,
  fetchPeriods,
  fetchTrialBalance,
  GL_MAPPING_DEFAULTS,
  GL_MAPPING_KEYS,
  postEntry,
  reverseEntry,
  updatePeriodStatus,
  type AccAccount,
  type AccEntryStatus,
  type AccJournal,
  type AccJournalEntry,
  type AccPeriod,
  type PatchSampleMeta,
  type TrialBalanceRow,
} from "@/lib/accounting";
import { putCompanySetting } from "@/lib/settings";
import { isAccountingPartialMode } from "@/lib/ops-visibility";
import { localizeUiString } from "@/lib/i18n/route-labels";
import { useStatusLabel } from "@/hooks/use-status-label";
import { useLocaleStore } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import { softSelect } from "@/lib/d294-ui";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";

type Tab = "coa" | "trial" | "entries" | "periods" | "mapping";

const ACCOUNTING_TABS: { id: Tab; label: string }[] = [
  { id: "coa", label: "Plan comptable" },
  { id: "trial", label: "Balance" },
  { id: "entries", label: "Écritures" },
  { id: "periods", label: "Périodes" },
  { id: "mapping", label: "Mapping GL" },
];

type GlMapForm = {
  ar: string;
  bank: string;
  revenue: string;
  vat: string;
  ap: string;
  expense: string;
  bankFee: string;
  salesJournal: string;
  bankJournal: string;
  purchasesJournal: string;
  ras: string;
  vatInput: string;
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
      patchSample?: PatchSampleMeta;
      periodId: string;
      mapping: GlMapForm;
    }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

function periodTone(
  status: string,
): "success" | "warning" | "neutral" | "danger" {
  if (status === "OPEN") return "success";
  if (status === "SOFT_CLOSED") return "warning";
  if (status === "CLOSED" || status === "LOCKED") return "danger";
  return "neutral";
}

function periodStatusLabel(status: string, locale: "fr" | "it"): string {
  const fr: Record<string, string> = {
    OPEN: "Ouverte",
    SOFT_CLOSED: "Soft close",
    CLOSED: "Clôturée",
    LOCKED: "Verrouillée",
  };
  const it: Record<string, string> = {
    OPEN: "Aperta",
    SOFT_CLOSED: "Soft close",
    CLOSED: "Chiusa",
    LOCKED: "Bloccata",
  };
  return (locale === "it" ? it : fr)[status] ?? status;
}

function AccountingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocaleStore((s) => s.locale);
  const { label: st } = useStatusLabel();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("coa");
  const [coaQ, setCoaQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | AccEntryStatus>("");
  const [mapDraft, setMapDraft] = useState<GlMapForm | null>(null);
  const [mapBusy, setMapBusy] = useState(false);
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [postBusy, setPostBusy] = useState<string | null>(null);
  const [periodBusy, setPeriodBusy] = useState<string | null>(null);
  const ghostEnabled = useShellStore((s) => s.ghostEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const opsVisibility = usePrefsStore((s) => s.opsVisibility);
  const partial = isAccountingPartialMode({
    ghostEnabled,
    patchEnabled,
    prefs: opsVisibility,
  });

  const syncUrl = useCallback(
    (next: { tab?: Tab; status?: "" | AccEntryStatus }) => {
      const sp = new URLSearchParams(searchParams.toString());
      const t = next.tab ?? tab;
      if (t === "coa") sp.delete("tab");
      else sp.set("tab", t);
      const stFilter = next.status !== undefined ? next.status : statusFilter;
      if (t === "entries" && stFilter) sp.set("status", stFilter);
      else sp.delete("status");
      const q = sp.toString();
      router.replace(q ? `/accounting?${q}` : "/accounting", { scroll: false });
    },
    [router, searchParams, statusFilter, tab],
  );

  const load = useCallback(
    async (periodId?: string, entryStatus?: "" | AccEntryStatus) => {
      setState({ kind: "loading" });
      const status =
        entryStatus !== undefined ? entryStatus : statusFilter || undefined;
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
        ? {
            ...GL_MAPPING_DEFAULTS,
            ...mapRes.data.codes,
            bankFee: mapRes.data.codes.bankFee ?? "",
            ras: mapRes.data.codes.ras ?? "",
            vatInput: mapRes.data.codes.vatInput ?? "",
          }
        : { ...GL_MAPPING_DEFAULTS };

      let trial: TrialBalanceRow[] = [];
      let entries: AccJournalEntry[] = [];
      let patchSample: PatchSampleMeta | undefined;
      const entryOpts = {
        limit: 50,
        ...(status ? { status } : {}),
      };
      if (selected) {
        const [tb, en] = await Promise.all([
          fetchTrialBalance(selected),
          fetchEntries({ periodId: selected, ...entryOpts }),
        ]);
        if (tb.ok) trial = tb.data.items;
        if (en.ok) {
          entries = en.data.items;
          patchSample = en.data.patchSample;
        }
      } else {
        const en = await fetchEntries(entryOpts);
        if (en.ok) {
          entries = en.data.items;
          patchSample = en.data.patchSample;
        }
      }

      setMapDraft(mapping);
      setState({
        kind: "ok",
        accounts: acc.data.items,
        journals,
        periods: per.data.items,
        trial,
        entries,
        patchSample,
        periodId: selected,
        mapping,
      });
    },
    [patchEnabled, statusFilter],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (
      t === "trial" ||
      t === "entries" ||
      t === "periods" ||
      t === "mapping" ||
      t === "coa"
    ) {
      setTab(t);
    }
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "POSTED" || s === "REVERSED") {
      setStatusFilter(s);
    } else if (!s) {
      setStatusFilter("");
    }
  }, [searchParams]);

  const accountOptions = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.accounts.filter((a) => a.active);
  }, [state]);

  const journalOptions = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.journals.filter((j) => j.active);
  }, [state]);

  const filteredAccounts = useMemo(() => {
    if (state.kind !== "ok") return [];
    const q = coaQ.trim().toLowerCase();
    if (!q) return state.accounts;
    return state.accounts.filter(
      (a) =>
        a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q),
    );
  }, [state, coaQ]);

  function selectTab(next: Tab) {
    setTab(next);
    syncUrl({ tab: next });
  }

  function selectStatus(next: "" | AccEntryStatus) {
    setStatusFilter(next);
    syncUrl({ tab: "entries", status: next });
  }

  async function saveMapping() {
    if (!mapDraft) return;
    setMapBusy(true);
    setMapMsg(null);
    const pairs: [string, string][] = [
      [GL_MAPPING_KEYS.ar, mapDraft.ar],
      [GL_MAPPING_KEYS.bank, mapDraft.bank],
      [GL_MAPPING_KEYS.revenue, mapDraft.revenue],
      [GL_MAPPING_KEYS.vat, mapDraft.vat],
      [GL_MAPPING_KEYS.ap, mapDraft.ap],
      [GL_MAPPING_KEYS.expense, mapDraft.expense],
      [GL_MAPPING_KEYS.bankFee, mapDraft.bankFee],
      [GL_MAPPING_KEYS.ras, mapDraft.ras],
      [GL_MAPPING_KEYS.vatInput, mapDraft.vatInput],
      [GL_MAPPING_KEYS.salesJournal, mapDraft.salesJournal],
      [GL_MAPPING_KEYS.bankJournal, mapDraft.bankJournal],
      [GL_MAPPING_KEYS.purchasesJournal, mapDraft.purchasesJournal],
    ];
    for (const [key, value] of pairs) {
      const r = await putCompanySetting(key, value.trim());
      if (!r.ok) {
        setMapMsg(r.message);
        setMapBusy(false);
        return;
      }
    }
    setMapMsg(`Mapping enregistré — applicable aux prochains ponts Finance→GL.`);
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

  async function onReverse(id: string) {
    setPostBusy(id);
    const r = await reverseEntry(id);
    setPostBusy(null);
    if (!r.ok) {
      setMapMsg(r.message);
      return;
    }
    setMapMsg(`Décomptabilisé → ${r.data.number}`);
    void load(state.kind === "ok" ? state.periodId : undefined);
  }

  async function onPeriodStatus(
    periodId: string,
    status: "OPEN" | "SOFT_CLOSED" | "CLOSED",
  ) {
    setPeriodBusy(periodId);
    setMapMsg(null);
    const r = await updatePeriodStatus(periodId, status);
    setPeriodBusy(null);
    if (!r.ok) {
      setMapMsg(r.message);
      return;
    }
    setMapMsg(`Période ${r.data.code} → ${r.data.status}`);
    void load(state.kind === "ok" ? state.periodId : undefined);
  }

  useEffect(() => {
    if (partial && tab !== "coa") setTab("coa");
  }, [partial, tab]);

  const periodSelect =
    state.kind === "ok" ? (
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
    ) : null;

  return (
    <>
      <AScreenHeader
        kicker="Comptabilité"
        title="Grand livre"
        description={
          partial
            ? "Mode ops — vue partielle (plan comptable seul). Préférences Admin : ops.*.accounting_partial."
            : state.kind === "ok"
              ? erpListDescription(
                  tab === "coa"
                    ? filteredAccounts.length
                    : tab === "entries"
                      ? state.entries.length
                      : tab === "trial"
                        ? state.trial.length
                        : null,
                  "Période CLOSED bloque le pont Finance→GL",
                )
              : "Plan comptable, périodes, écritures, mapping Finance→GL."
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "customers",
                label: "Hub clients",
                onSelect: () => router.push("/customers"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <APageSection className="flex flex-wrap items-center gap-3 py-3">
          <ABadge tone="neutral">IA DISABLED</ABadge>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            Comptabilité intelligente = Thunder FIN-INTEL (pression crédit,
            jalons recouvrement, décompta) — jamais une dépendance runtime IA.
            Préférences : seuils Admin.
          </p>
        </APageSection>

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
            <ATabs
              variant="underline"
              ariaLabel="Sections comptabilité"
              value={tab}
              onValueChange={(id) => selectTab(id as Tab)}
              items={ACCOUNTING_TABS.filter(
                (t) => !partial || t.id === "coa",
              )}
            />

            {mapMsg ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {mapMsg}
              </p>
            ) : null}

            {tab === "coa" ? (
              <APageSection bare>
                <AFilterBar
                  search={
                    <AInput
                      value={coaQ}
                      onChange={(e) => setCoaQ(e.target.value)}
                      placeholder="Rechercher code ou nom…"
                      className="min-w-[14rem] max-w-sm"
                      aria-label="Filtrer plan comptable"
                    />
                  }
                  utilities={
                    <AListUtilities onFilter={() => void load()} />
                  }
                />
                {filteredAccounts.length === 0 ? (
                  <AEmptyState
                    title="Aucun compte"
                    description={
                      coaQ.trim()
                        ? "Aucun compte ne correspond au filtre."
                        : "Les comptes seed apparaissent après seed."
                    }
                  />
                ) : (
                  <ASoftTable>
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>
                          {localizeUiString("Code", locale) ?? "Code"}
                        </ASoftTh>
                        <ASoftTh>
                          {localizeUiString("Nom", locale) ?? "Nom"}
                        </ASoftTh>
                        <ASoftTh>
                          {localizeUiString("Type", locale) ?? "Type"}
                        </ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {filteredAccounts.map((a) => (
                        <ASoftTr key={a.id}>
                          <ASoftTd className="a-mono">{a.code}</ASoftTd>
                          <ASoftTd>{a.name}</ASoftTd>
                          <ASoftTd>
                            <ABadge tone="neutral">{a.type}</ABadge>
                          </ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            ) : null}

            {tab === "trial" ? (
              <APageSection bare>
                <AFilterBar
                  filters={periodSelect}
                  utilities={
                    <AListUtilities onFilter={() => void load()} />
                  }
                />
                {state.trial.length === 0 ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucune écriture POSTED pour cette période.
                  </p>
                ) : (
                  <ASoftTable>
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>Compte</ASoftTh>
                        <ASoftTh numeric>Débit</ASoftTh>
                        <ASoftTh numeric>Crédit</ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {state.trial.map((r) => (
                        <ASoftTr key={r.accountId}>
                          <ASoftTd>
                            <span className="a-mono">{r.accountCode}</span>{" "}
                            {r.accountName}
                          </ASoftTd>
                          <ASoftTd numeric>{r.debit}</ASoftTd>
                          <ASoftTd numeric>{r.credit}</ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            ) : null}

            {tab === "entries" ? (
              <APageSection bare>
                <AFilterBar
                  filters={
                    <>
                      {periodSelect}
                      <ATabs
                        ariaLabel="Filtrer par statut"
                        value={statusFilter || "all"}
                        onValueChange={(id) => {
                          const next = (
                            id === "all" ? "" : id
                          ) as "" | AccEntryStatus;
                          selectStatus(next);
                        }}
                        items={ENTRY_STATUS_FILTERS.map((chip) => ({
                          id: chip.id || "all",
                          label: chip.label,
                        }))}
                      />
                      {state.patchSample?.applied ? (
                        <ABadge tone="warning">
                          PATCH échantillon {state.patchSample.kept}/
                          {state.patchSample.total} ·{" "}
                          {state.patchSample.intensity} %
                        </ABadge>
                      ) : null}
                    </>
                  }
                  utilities={
                    <AListUtilities onFilter={() => void load()} />
                  }
                />
                {state.entries.length === 0 ? (
                  <AEmptyState
                    title="Aucune écriture"
                    description="Les ponts Finance→GL et les brouillons apparaîtront ici."
                  />
                ) : (
                  <ASoftTable>
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>N°</ASoftTh>
                        <ASoftTh>Date</ASoftTh>
                        <ASoftTh>Journal</ASoftTh>
                        <ASoftTh>Statut</ASoftTh>
                        <ASoftTh>Source</ASoftTh>
                        <ASoftTh className="text-right">Action</ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {state.entries.map((e) => (
                        <ASoftTr
                          key={e.id}
                          onClick={() =>
                            router.push(`/accounting/entries/${e.id}`)
                          }
                        >
                          <ASoftTd className="a-mono">
                            <Link
                              href={`/accounting/entries/${e.id}`}
                              className="text-a-accent hover:underline"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {e.number}
                            </Link>
                          </ASoftTd>
                          <ASoftTd className="a-mono">{e.entryDate}</ASoftTd>
                          <ASoftTd className="a-mono">
                            {e.journalCode ?? "—"}
                          </ASoftTd>
                          <ASoftTd>
                            <ABadge tone={entryBadgeTone(e.status)}>
                              {st(e.status)}
                            </ABadge>
                          </ASoftTd>
                          <ASoftTd className="a-mono text-a-fg-muted">
                            {e.sourceType ?? "—"}
                          </ASoftTd>
                          <ASoftTd className="text-right">
                            <div
                              className="flex flex-wrap justify-end gap-1"
                              onClick={(ev) => ev.stopPropagation()}
                            >
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
                              {e.status === "POSTED" ? (
                                <AButton
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={postBusy === e.id}
                                  onClick={() => void onReverse(e.id)}
                                >
                                  {postBusy === e.id
                                    ? "…"
                                    : "Décomptabiliser"}
                                </AButton>
                              ) : null}
                              <AButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  router.push(`/accounting/entries/${e.id}`)
                                }
                              >
                                Ouvrir
                              </AButton>
                            </div>
                          </ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            ) : null}

            {tab === "periods" ? (
              <APageSection
                bare
                description="Clôturer une période bloque le pont Finance→GL pour les dates couvertes (et le post manuel). Rouvrir = statut OPEN. LOCKED est immutable."
              >
                {state.periods.length === 0 ? (
                  <AEmptyState
                    title="Aucune période"
                    description="Créez des périodes fiscales (API / seed)."
                  />
                ) : (
                  <ASoftTable className="min-w-[640px]">
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>Code</ASoftTh>
                        <ASoftTh>Début</ASoftTh>
                        <ASoftTh>Fin</ASoftTh>
                        <ASoftTh>Statut</ASoftTh>
                        <ASoftTh>Actions</ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {state.periods.map((p) => (
                        <ASoftTr key={p.id}>
                          <ASoftTd className="a-mono">{p.code}</ASoftTd>
                          <ASoftTd className="a-mono">{p.startDate}</ASoftTd>
                          <ASoftTd className="a-mono">{p.endDate}</ASoftTd>
                          <ASoftTd>
                            <ABadge tone={periodTone(p.status)}>
                              {periodStatusLabel(p.status, locale)}
                            </ABadge>
                          </ASoftTd>
                          <ASoftTd>
                            <div className="flex flex-wrap gap-2">
                              {p.status === "OPEN" ? (
                                <>
                                  <AButton
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={periodBusy === p.id}
                                    onClick={() =>
                                      void onPeriodStatus(p.id, "SOFT_CLOSED")
                                    }
                                  >
                                    Soft close
                                  </AButton>
                                  <AButton
                                    type="button"
                                    size="sm"
                                    disabled={periodBusy === p.id}
                                    onClick={() =>
                                      void onPeriodStatus(p.id, "CLOSED")
                                    }
                                  >
                                    Clôturer
                                  </AButton>
                                </>
                              ) : null}
                              {p.status === "SOFT_CLOSED" ||
                              p.status === "CLOSED" ? (
                                <AButton
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={periodBusy === p.id}
                                  onClick={() =>
                                    void onPeriodStatus(p.id, "OPEN")
                                  }
                                >
                                  Rouvrir
                                </AButton>
                              ) : null}
                              {p.status === "LOCKED" ? (
                                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                  Immutable
                                </span>
                              ) : null}
                            </div>
                          </ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            ) : null}

            {tab === "mapping" && mapDraft ? (
              <APageSection
                title="Mapping Finance→GL"
                description="Codes de comptes et journaux utilisés par le pont Finance→GL. Saisie société — pas de taux fiscaux."
                action={
                  <>
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
                  </>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["ar", "Clients (AR)", "account"],
                      ["bank", "Banque", "account"],
                      ["revenue", "Ventes / produits", "account"],
                      ["vat", "TVA collectée (as-recorded)", "account"],
                      ["ap", "Fournisseurs (AP)", "account"],
                      ["expense", "Achats / charges (AP)", "account"],
                      ["bankFee", "Frais bancaires", "account"],
                      ["ras", "RAS à payer (GL)", "account"],
                      ["vatInput", "TVA déductible (AP)", "account"],
                      ["salesJournal", "Journal ventes", "journal"],
                      ["bankJournal", "Journal banque", "journal"],
                      ["purchasesJournal", "Journal achats", "journal"],
                    ] as const
                  ).map(([field, label, kind]) => (
                    <label
                      key={field}
                      className="block text-[length:var(--a-text-sm)] text-a-fg-muted"
                    >
                      {localizeUiString(label, locale) ?? label}
                      <select
                        className={cn(softSelect, "mt-1")}
                        value={mapDraft[field]}
                        onChange={(e) =>
                          setMapDraft((d) =>
                            d ? { ...d, [field]: e.target.value } : d,
                          )
                        }
                      >
                        {field === "bankFee" ||
                        field === "ras" ||
                        field === "vatInput" ? (
                          <option value="">— non configuré</option>
                        ) : null}
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
                        {mapDraft[field] &&
                        kind === "account" &&
                        !accountOptions.some(
                          (a) => a.code === mapDraft[field],
                        ) ? (
                          <option value={mapDraft[field]}>
                            {mapDraft[field]} (non trouvé)
                          </option>
                        ) : null}
                        {kind === "journal" &&
                        mapDraft[field] &&
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
              </APageSection>
            ) : null}
          </>
        ) : null}
      </APageBody>
    </>
  );
}

export default function AccountingPage() {
  return (
    <Suspense fallback={<ASkeleton className="m-6 h-32 w-full" />}>
      <AccountingPageInner />
    </Suspense>
  );
}

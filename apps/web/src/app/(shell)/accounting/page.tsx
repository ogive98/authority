"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  FileText,
  GitBranch,
  Scale,
  type LucideIcon,
} from "lucide-react";
import {
  ABadge,
  AButton,
  AEmptyState,
  AErrorState,
  AFilterBar,
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
import {
  softChipClass,
  softSelect,
  softUnderlineTabClass,
} from "@/lib/soft-glass-ui";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";

type Tab = "coa" | "trial" | "entries" | "periods" | "mapping";

type GlMapForm = {
  ar: string;
  bank: string;
  revenue: string;
  vat: string;
  bankFee: string;
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
      [GL_MAPPING_KEYS.bankFee, mapDraft.bankFee],
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
            : "Plan comptable, périodes (clôture), écritures, mapping Finance→GL. Période CLOSED bloque le pont Finance→GL."
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
            <div className="flex flex-wrap gap-5 border-b border-transparent">
              {(
                (
                  [
                    ["coa", "Plan comptable", BookOpen],
                    ["trial", "Balance", Scale],
                    ["entries", "Écritures", FileText],
                    ["periods", "Périodes", CalendarRange],
                    ["mapping", "Mapping GL", GitBranch],
                  ] as const satisfies ReadonlyArray<
                    readonly [Tab, string, LucideIcon]
                  >
                ).filter(([id]) => !partial || id === "coa")
              ).map(([id, label, Icon]) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={softUnderlineTabClass(active)}
                    onClick={() => selectTab(id)}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-white" : "text-white/55",
                      )}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <span>{localizeUiString(label, locale) ?? label}</span>
                  </button>
                );
              })}
            </div>

            {mapMsg ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {mapMsg}
              </p>
            ) : null}

            {tab === "coa" ? (
              <APageSection bare>
                <AFilterBar
                  filters={
                    <AInput
                      value={coaQ}
                      onChange={(e) => setCoaQ(e.target.value)}
                      placeholder="Rechercher code ou nom…"
                      className="min-w-[14rem] max-w-sm"
                      aria-label="Filtrer plan comptable"
                    />
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
                      <tr>
                        <th className="a-table-cell font-medium">
                          {localizeUiString("Code", locale) ?? "Code"}
                        </th>
                        <th className="a-table-cell font-medium">
                          {localizeUiString("Nom", locale) ?? "Nom"}
                        </th>
                        <th className="a-table-cell font-medium">
                          {localizeUiString("Type", locale) ?? "Type"}
                        </th>
                      </tr>
                    </ASoftThead>
                    <tbody>
                      {filteredAccounts.map((a) => (
                        <ASoftTr key={a.id}>
                          <td className="a-mono a-table-cell">{a.code}</td>
                          <td className="a-table-cell">{a.name}</td>
                          <td className="a-table-cell">
                            <ABadge tone="neutral">{a.type}</ABadge>
                          </td>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                )}
              </APageSection>
            ) : null}

            {tab === "trial" ? (
              <APageSection bare>
                <AFilterBar filters={periodSelect} />
                {state.trial.length === 0 ? (
                  <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Aucune écriture POSTED pour cette période.
                  </p>
                ) : (
                  <ASoftTable>
                    <ASoftThead>
                      <tr>
                        <th className="a-table-cell font-medium">Compte</th>
                        <th className="a-table-cell font-medium text-right">
                          Débit
                        </th>
                        <th className="a-table-cell font-medium text-right">
                          Crédit
                        </th>
                      </tr>
                    </ASoftThead>
                    <tbody>
                      {state.trial.map((r) => (
                        <ASoftTr key={r.accountId}>
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
                      <div className="flex flex-wrap gap-2">
                        {ENTRY_STATUS_FILTERS.map((chip) => {
                          const active = statusFilter === chip.id;
                          return (
                            <button
                              key={chip.id || "all"}
                              type="button"
                              className={softChipClass(active)}
                              onClick={() => selectStatus(chip.id)}
                            >
                              {localizeUiString(chip.label, locale) ??
                                chip.label}
                            </button>
                          );
                        })}
                      </div>
                      {state.patchSample?.applied ? (
                        <ABadge tone="warning">
                          PATCH échantillon {state.patchSample.kept}/
                          {state.patchSample.total} ·{" "}
                          {state.patchSample.intensity} %
                        </ABadge>
                      ) : null}
                    </>
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
                    </ASoftThead>
                    <tbody>
                      {state.entries.map((e) => (
                        <ASoftTr
                          key={e.id}
                          onClick={() =>
                            router.push(`/accounting/entries/${e.id}`)
                          }
                        >
                          <td className="a-mono a-table-cell">
                            <Link
                              href={`/accounting/entries/${e.id}`}
                              className="text-a-accent hover:underline"
                              onClick={(ev) => ev.stopPropagation()}
                            >
                              {e.number}
                            </Link>
                          </td>
                          <td className="a-mono a-table-cell">
                            {e.entryDate}
                          </td>
                          <td className="a-mono a-table-cell">
                            {e.journalCode ?? "—"}
                          </td>
                          <td className="a-table-cell">
                            <ABadge tone={entryBadgeTone(e.status)}>
                              {st(e.status)}
                            </ABadge>
                          </td>
                          <td className="a-mono a-table-cell text-a-fg-muted">
                            {e.sourceType ?? "—"}
                          </td>
                          <td className="a-table-cell text-right">
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
                          </td>
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
                      <tr>
                        <th className="a-table-cell font-medium">Code</th>
                        <th className="a-table-cell font-medium">Début</th>
                        <th className="a-table-cell font-medium">Fin</th>
                        <th className="a-table-cell font-medium">Statut</th>
                        <th className="a-table-cell font-medium">Actions</th>
                      </tr>
                    </ASoftThead>
                    <tbody>
                      {state.periods.map((p) => (
                        <ASoftTr key={p.id}>
                          <td className="a-mono a-table-cell">{p.code}</td>
                          <td className="a-mono a-table-cell">
                            {p.startDate}
                          </td>
                          <td className="a-mono a-table-cell">{p.endDate}</td>
                          <td className="a-table-cell">
                            <ABadge tone={periodTone(p.status)}>
                              {periodStatusLabel(p.status, locale)}
                            </ABadge>
                          </td>
                          <td className="a-table-cell">
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
                          </td>
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
                      ["bankFee", "Frais bancaires", "account"],
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
                        {field === "bankFee" ? (
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

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  addBankLines,
  bankLineBadgeTone,
  createBankAccount,
  fetchBankAccounts,
  fetchBankLines,
  fetchBankMatchCandidates,
  fetchBankTreasury,
  ignoreBankLine,
  importBankCsv,
  matchBankLine,
  previewBankCsv,
  unignoreBankLine,
  unmatchBankLine,
  type BankCsvPreview,
  type BankMatchCandidates,
  type BankTreasury,
  type FinBankAccount,
  type FinBankStatementLine,
} from "@/lib/finance";
import {
  softChipClass,
  softPageBody,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; accounts: FinBankAccount[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineFilter = "" | "UNMATCHED" | "MATCHED" | "IGNORED";

export default function FinanceBankingPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [treasury, setTreasury] = useState<BankTreasury | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<FinBankStatementLine[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [lineFilter, setLineFilter] = useState<LineFilter>("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [accountOpen, setAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState<{
    code: string;
    label: string;
    bankName: string;
    rib: string;
    glAccountCode: string;
  } | null>(null);

  const [lineOpen, setLineOpen] = useState(false);
  const [lineForm, setLineForm] = useState<{
    lineDate: string;
    amount: string;
    reference: string;
    counterparty: string;
    memo: string;
  } | null>(null);

  const [matchOpen, setMatchOpen] = useState(false);
  const [candidates, setCandidates] = useState<BankMatchCandidates | null>(
    null,
  );

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<BankCsvPreview | null>(null);

  const loadAccounts = useCallback(async () => {
    setState({ kind: "loading" });
    const [res, tre] = await Promise.all([
      fetchBankAccounts(),
      fetchBankTreasury(),
    ]);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({ kind: "error", message: res.message });
      return;
    }
    setState({ kind: "ok", accounts: res.data.items });
    if (tre.ok) setTreasury(tre.data);
    setSelectedId((prev) => {
      if (prev && res.data.items.some((a) => a.id === prev)) return prev;
      return res.data.items[0]?.id ?? null;
    });
  }, []);

  const loadLines = useCallback(
    async (accountId: string, filter: LineFilter) => {
      setLinesLoading(true);
      const res = await fetchBankLines(accountId, {
        status: filter || undefined,
      });
      setLinesLoading(false);
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setLines(res.data.items);
      setFormError(null);
    },
    [],
  );

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedId) void loadLines(selectedId, lineFilter);
    else setLines([]);
  }, [selectedId, lineFilter, loadLines]);

  const refresh = useCallback(async () => {
    await loadAccounts();
    if (selectedId) await loadLines(selectedId, lineFilter);
  }, [loadAccounts, loadLines, selectedId, lineFilter]);

  async function onCreateAccount() {
    if (!accountForm) return;
    setBusy(true);
    setFormError(null);
    const res = await createBankAccount({
      code: accountForm.code,
      label: accountForm.label,
      bankName: accountForm.bankName || undefined,
      rib: accountForm.rib || undefined,
      glAccountCode: accountForm.glAccountCode || undefined,
      isDefault: true,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setAccountOpen(false);
    setAccountForm(null);
    await loadAccounts();
    setSelectedId(res.data.id);
  }

  async function onAddLine() {
    if (!lineForm || !selectedId) return;
    const amount = Number(lineForm.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount === 0) {
      setFormError("Montant TND requis (≠ 0).");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await addBankLines(selectedId, [
      {
        lineDate: lineForm.lineDate,
        amount,
        reference: lineForm.reference || undefined,
        counterparty: lineForm.counterparty || undefined,
        memo: lineForm.memo || undefined,
      },
    ]);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setLineOpen(false);
    setLineForm(null);
    await refresh();
  }

  async function openMatch(lineId: string) {
    setBusy(true);
    setFormError(null);
    const res = await fetchBankMatchCandidates(lineId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCandidates(res.data);
    setMatchOpen(true);
  }

  async function onMatch(body: {
    paymentId?: string;
    instrumentId?: string;
  }) {
    if (!candidates) return;
    setBusy(true);
    const res = await matchBankLine(candidates.line.id, body);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setMatchOpen(false);
    setCandidates(null);
    await refresh();
  }

  async function onUnmatch(lineId: string) {
    if (!window.confirm("Délier ce rapprochement ? (aucun impact GL)")) return;
    setBusy(true);
    const res = await unmatchBankLine(lineId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    await refresh();
  }

  async function onIgnore(lineId: string) {
    const memo =
      window.prompt(
        "Mémo (frais / orphelin — pas de GL)",
        "Frais bancaires",
      ) ?? undefined;
    if (memo === undefined) return;
    setBusy(true);
    const res = await ignoreBankLine(lineId, memo || undefined);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    await refresh();
  }

  async function onUnignore(lineId: string) {
    setBusy(true);
    const res = await unignoreBankLine(lineId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    await refresh();
  }

  async function onCsvPreview() {
    if (!selectedId || !csvText.trim()) return;
    setBusy(true);
    setFormError(null);
    const res = await previewBankCsv(selectedId, csvText);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      setCsvPreview(null);
      return;
    }
    setCsvPreview(res.data);
  }

  async function onCsvImport() {
    if (!selectedId || !csvText.trim()) return;
    setBusy(true);
    setFormError(null);
    const res = await importBankCsv(selectedId, csvText);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setCsvOpen(false);
    setCsvText("");
    setCsvPreview(null);
    await refresh();
  }

  const selected =
    state.kind === "ok"
      ? (state.accounts.find((a) => a.id === selectedId) ?? null)
      : null;

  const csvSample = useMemo(
    () =>
      [
        "date,amount,reference,counterparty,memo",
        "2026-09-01,150.000,VIR-1,Client A,",
        "2026-09-02,-5.250,FRAIS,,Frais bancaires",
      ].join("\n"),
    [],
  );

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Banque"
        description="Rapprochement soft + CSV (+/−) + ignore frais — GL banque reste à l’affectation. Pas d’OFX."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/finance/payments"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Encaissements
            </Link>
            <Link
              href="/finance/instruments"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Instruments
            </Link>
            <AButton
              type="button"
              size="sm"
              onClick={() => {
                setAccountForm({
                  code: "",
                  label: "",
                  bankName: "",
                  rib: "",
                  glAccountCode: "",
                });
                setFormError(null);
                setAccountOpen(true);
              }}
            >
              Nouveau compte
            </AButton>
          </div>
        }
      />

      <div className={softPageBody}>
        {state.kind === "loading" ? <ASkeleton className="h-40 w-full" /> : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState message={state.message} onRetry={() => void loadAccounts()} />
        ) : null}

        {treasury && state.kind === "ok" ? (
          <div className="a-underlay grid gap-3 rounded-md p-[var(--a-space-4)] sm:grid-cols-4">
            <Kpi label="Comptes" value={String(treasury.accountCount)} />
            <Kpi
              label="Non rapprochées"
              value={String(treasury.unmatchedCount)}
            />
            <Kpi label="Rapprochées" value={String(treasury.matchedCount)} />
            <Kpi label="Ignorées" value={String(treasury.ignoredCount)} />
          </div>
        ) : null}

        {state.kind === "ok" && state.accounts.length === 0 ? (
          <AEmptyState
            title="Aucun compte"
            description="Créez un compte bancaire société (RIB/IBAN libres). Pas d’annuaire inventé."
            actionLabel="Nouveau compte"
            onAction={() => {
              setAccountForm({
                code: "BQ1",
                label: "Compte principal",
                bankName: "",
                rib: "",
                glAccountCode: "",
              });
              setAccountOpen(true);
            }}
          />
        ) : null}

        {state.kind === "ok" && state.accounts.length > 0 ? (
          <>
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Comptes bancaires"
            >
              {state.accounts.map((a) => {
                const active = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedId(a.id)}
                    className={softChipClass(active)}
                  >
                    {a.code}
                    {a.unmatchedCount > 0 ? ` · ${a.unmatchedCount}` : ""}
                  </button>
                );
              })}
            </div>

            {selected ? (
              <div className="a-underlay rounded-md p-[var(--a-space-4)] space-y-1">
                <p className="text-[length:var(--a-text-base)] font-medium text-a-fg">
                  {selected.label}
                  {selected.isDefault ? " · défaut" : ""}
                </p>
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted a-mono">
                  {[selected.bankName, selected.rib, selected.iban]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                  {selected.glAccountCode
                    ? ` · GL ${selected.glAccountCode}`
                    : " · GL via accounting.gl.bank"}
                  {` · M${selected.matchedCount}/I${selected.ignoredCount}`}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: "" as LineFilter, label: "Toutes" },
                  { id: "UNMATCHED" as LineFilter, label: "Non rapprochées" },
                  { id: "MATCHED" as LineFilter, label: "Rapprochées" },
                  { id: "IGNORED" as LineFilter, label: "Ignorées" },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id || "all"}
                  type="button"
                  onClick={() => setLineFilter(chip.id)}
                  className={softChipClass(lineFilter === chip.id)}
                >
                  {chip.label}
                </button>
              ))}
              <div className="flex-1" />
              <AButton
                type="button"
                size="sm"
                variant="secondary"
                disabled={!selectedId}
                onClick={() => {
                  setCsvText(csvSample);
                  setCsvPreview(null);
                  setFormError(null);
                  setCsvOpen(true);
                }}
              >
                Import CSV
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={!selectedId}
                onClick={() => {
                  setLineForm({
                    lineDate: new Date().toISOString().slice(0, 10),
                    amount: "",
                    reference: "",
                    counterparty: "",
                    memo: "",
                  });
                  setFormError(null);
                  setLineOpen(true);
                }}
              >
                Ajouter ligne
              </AButton>
            </div>

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}

            {linesLoading ? <ASkeleton className="h-32 w-full" /> : null}

            {!linesLoading && lines.length === 0 ? (
              <AEmptyState
                title="Aucune ligne"
                description="Saisie manuelle ou import CSV (date,amount,…). + crédit / − débit."
              />
            ) : null}

            {!linesLoading && lines.length > 0 ? (
              <div className={softTableWrap}>
                <table className="w-full text-left text-[length:var(--a-text-sm)]">
                  <thead className={softThead}>
                    <tr>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Montant</th>
                      <th className="px-3 py-2 font-medium">Réf.</th>
                      <th className="px-3 py-2 font-medium">Statut</th>
                      <th className="px-3 py-2 font-medium">Lien</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.id} className={softTr}>
                        <td className="px-3 py-2 a-mono">{line.lineDate}</td>
                        <td className="px-3 py-2 a-mono tabular-nums">
                          {line.amount} {line.currency}
                        </td>
                        <td className="px-3 py-2">
                          {line.reference || line.counterparty || line.memo || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <ABadge tone={bankLineBadgeTone(line.status)}>
                            {line.status === "MATCHED"
                              ? "Rapproché"
                              : line.status === "UNMATCHED"
                                ? "Ouvert"
                                : "Ignoré"}
                          </ABadge>
                        </td>
                        <td className="px-3 py-2 a-mono text-a-fg-muted">
                          {line.match?.paymentNumber ||
                            line.match?.instrumentNumber ||
                            "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {line.status === "UNMATCHED" ? (
                              <>
                                <AButton
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void openMatch(line.id)}
                                >
                                  Rapprocher
                                </AButton>
                                <AButton
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => void onIgnore(line.id)}
                                >
                                  Ignorer
                                </AButton>
                              </>
                            ) : null}
                            {line.status === "MATCHED" ? (
                              <AButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void onUnmatch(line.id)}
                              >
                                Délier
                              </AButton>
                            ) : null}
                            {line.status === "IGNORED" ? (
                              <AButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                onClick={() => void onUnignore(line.id)}
                              >
                                Réouvrir
                              </AButton>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <ADrawer
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title="Nouveau compte bancaire"
      >
        {accountForm ? (
          <div className="space-y-3">
            <Field
              label="Code"
              value={accountForm.code}
              onChange={(v) => setAccountForm({ ...accountForm, code: v })}
            />
            <Field
              label="Libellé"
              value={accountForm.label}
              onChange={(v) => setAccountForm({ ...accountForm, label: v })}
            />
            <Field
              label="Banque"
              value={accountForm.bankName}
              onChange={(v) => setAccountForm({ ...accountForm, bankName: v })}
            />
            <Field
              label="RIB"
              value={accountForm.rib}
              onChange={(v) => setAccountForm({ ...accountForm, rib: v })}
            />
            <Field
              label="Compte GL (optionnel)"
              value={accountForm.glAccountCode}
              onChange={(v) =>
                setAccountForm({ ...accountForm, glAccountCode: v })
              }
            />
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <AButton
              type="button"
              disabled={busy || !accountForm.code || !accountForm.label}
              onClick={() => void onCreateAccount()}
            >
              Créer
            </AButton>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={lineOpen}
        onOpenChange={setLineOpen}
        title="Ligne de relevé"
      >
        {lineForm ? (
          <div className="space-y-3">
            <Field
              label="Date"
              type="date"
              value={lineForm.lineDate}
              onChange={(v) => setLineForm({ ...lineForm, lineDate: v })}
            />
            <Field
              label="Montant TND (+ crédit / − débit)"
              value={lineForm.amount}
              onChange={(v) => setLineForm({ ...lineForm, amount: v })}
            />
            <Field
              label="Référence"
              value={lineForm.reference}
              onChange={(v) => setLineForm({ ...lineForm, reference: v })}
            />
            <Field
              label="Contrepartie"
              value={lineForm.counterparty}
              onChange={(v) => setLineForm({ ...lineForm, counterparty: v })}
            />
            <Field
              label="Mémo"
              value={lineForm.memo}
              onChange={(v) => setLineForm({ ...lineForm, memo: v })}
            />
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <AButton
              type="button"
              disabled={busy}
              onClick={() => void onAddLine()}
            >
              Enregistrer
            </AButton>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={csvOpen}
        onOpenChange={setCsvOpen}
        title="Import CSV"
        description="Colonnes date,amount,reference,counterparty,memo — + crédit / − débit. Pas d’OFX."
      >
        <div className="space-y-3">
          <textarea
            className="a-underlay a-mono min-h-[12rem] w-full rounded-md p-3 text-[length:var(--a-text-xs)] text-a-fg"
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setCsvPreview(null);
            }}
            spellCheck={false}
          />
          {csvPreview ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              {csvPreview.lineCount} ligne(s) · délimiteur «{" "}
              {csvPreview.delimiter} » · {csvPreview.errorCount} erreur(s)
            </p>
          ) : null}
          {csvPreview && csvPreview.errors.length > 0 ? (
            <ul className="text-[length:var(--a-text-xs)] text-a-warning space-y-1">
              {csvPreview.errors.slice(0, 5).map((e) => (
                <li key={`${e.row}-${e.message}`}>
                  L{e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : null}
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !csvText.trim()}
              onClick={() => void onCsvPreview()}
            >
              Prévisualiser
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !csvText.trim()}
              onClick={() => void onCsvImport()}
            >
              Importer
            </AButton>
          </div>
        </div>
      </ADrawer>

      <ADrawer
        open={matchOpen}
        onOpenChange={setMatchOpen}
        title="Rapprocher"
      >
        {candidates ? (
          <div className="space-y-4">
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Ligne{" "}
              <span className="a-mono text-a-fg">
                {candidates.line.amount} TND
              </span>{" "}
              — candidats montant exact (paiement ou instrument).
            </p>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <div>
              <h4 className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Encaissements
              </h4>
              {candidates.payments.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun paiement POSTED non lié.
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 a-underlay rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="a-mono text-[length:var(--a-text-sm)]">
                          {p.number}
                        </p>
                        <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {p.customerName || "—"} · {p.method} · {p.paymentDate}
                        </p>
                      </div>
                      <AButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onMatch({ paymentId: p.id })}
                      >
                        Lier
                      </AButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Instruments
              </h4>
              {candidates.instruments.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun chèque/traite non lié.
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.instruments.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center justify-between gap-2 a-underlay rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="a-mono text-[length:var(--a-text-sm)]">
                          {i.number}
                        </p>
                        <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {i.type} · {i.status} · {i.paymentNumber}
                        </p>
                      </div>
                      <AButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onMatch({ instrumentId: i.id })}
                      >
                        Lier
                      </AButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">{label}</p>
      <p className="a-mono text-[length:var(--a-text-lg)] tabular-nums text-a-fg">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="text-[length:var(--a-text-sm)] text-a-fg-muted"
      >
        {label}
      </label>
      <AInput
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

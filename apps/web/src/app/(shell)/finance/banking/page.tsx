"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
} from "@/components/a";
import {
  addBankLines,
  bankLineBadgeTone,
  createApPayment,
  createBankAccount,
  fetchApPayments,
  fetchBankAccounts,
  fetchBankLines,
  fetchBankMatchCandidates,
  fetchBankTreasury,
  ignoreBankLine,
  importBankCsv,
  importBankOfx,
  matchBankLine,
  postBankFee,
  previewBankCsv,
  previewBankOfx,
  unignoreBankLine,
  unmatchBankLine,
  type BankCsvPreview,
  type BankMatchCandidates,
  type BankOfxPreview,
  type BankTreasury,
  type FinApPayment,
  type FinBankAccount,
  type FinBankStatementLine,
} from "@/lib/finance";
import {
  softChipClass,
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
  const router = useRouter();
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
  const [apPayments, setApPayments] = useState<FinApPayment[]>([]);
  const [apOpen, setApOpen] = useState(false);
  const [apForm, setApForm] = useState<{
    vendorName: string;
    amount: string;
    method: string;
    paymentDate: string;
    reference: string;
  } | null>(null);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<BankCsvPreview | null>(null);

  const [ofxOpen, setOfxOpen] = useState(false);
  const [ofxText, setOfxText] = useState("");
  const [ofxPreview, setOfxPreview] = useState<BankOfxPreview | null>(null);

  const loadAp = useCallback(async () => {
    const res = await fetchApPayments();
    if (res.ok) setApPayments(res.data.items);
  }, []);

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
    void loadAp();
  }, [loadAccounts, loadAp]);

  useEffect(() => {
    if (selectedId) void loadLines(selectedId, lineFilter);
    else setLines([]);
  }, [selectedId, lineFilter, loadLines]);

  const refresh = useCallback(async () => {
    await loadAccounts();
    await loadAp();
    if (selectedId) await loadLines(selectedId, lineFilter);
  }, [loadAccounts, loadAp, loadLines, selectedId, lineFilter]);

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
    apPaymentId?: string;
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

  async function onCreateAp() {
    if (!apForm) return;
    const amount = Number(apForm.amount.replace(",", "."));
    if (!apForm.vendorName.trim() || !Number.isFinite(amount) || amount <= 0) {
      setFormError("Fournisseur et montant TND > 0 requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createApPayment({
      vendorName: apForm.vendorName.trim(),
      amount,
      method: apForm.method,
      paymentDate: apForm.paymentDate,
      reference: apForm.reference || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setApOpen(false);
    setApForm(null);
    await loadAp();
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

  async function onOfxPreview() {
    if (!selectedId || !ofxText.trim()) return;
    setBusy(true);
    setFormError(null);
    const res = await previewBankOfx(selectedId, ofxText);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      setOfxPreview(null);
      return;
    }
    setOfxPreview(res.data);
  }

  async function onOfxImport() {
    if (!selectedId || !ofxText.trim()) return;
    setBusy(true);
    setFormError(null);
    const res = await importBankOfx(selectedId, ofxText);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setOfxOpen(false);
    setOfxText("");
    setOfxPreview(null);
    await refresh();
  }

  async function onPostFee(lineId: string) {
    setBusy(true);
    setFormError(null);
    const res = await postBankFee(lineId);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
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

  function openAccountCreate(defaults?: {
    code: string;
    label: string;
  }) {
    setAccountForm({
      code: defaults?.code ?? "",
      label: defaults?.label ?? "",
      bankName: "",
      rib: "",
      glAccountCode: "",
    });
    setFormError(null);
    setAccountOpen(true);
  }

  const ofxSample = useMemo(
    () =>
      [
        "OFXHEADER:100",
        "DATA:OFXSGML",
        "VERSION:102",
        "",
        "<OFX>",
        "<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>",
        "<STMTTRN>",
        "<TRNTYPE>CREDIT",
        "<DTPOSTED>20260901",
        "<TRNAMT>150.000",
        "<FITID>FIT-001",
        "<NAME>Client A",
        "<MEMO>Virement",
        "</STMTTRN>",
        "<STMTTRN>",
        "<TRNTYPE>DEBIT",
        "<DTPOSTED>20260902",
        "<TRNAMT>-5.250",
        "<FITID>FIT-002",
        "<NAME>FRAIS",
        "<MEMO>Frais bancaires",
        "</STMTTRN>",
        "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>",
        "</OFX>",
      ].join("\n"),
    [],
  );

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Banque"
        description="Rapprochement soft AR (+) / AP (−) · CSV/OFX · ignore sans GL · frais (Prefs bank_fee)."
        primary={
          <AButton type="button" size="sm" onClick={() => openAccountCreate()}>
            Nouveau compte
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "payments",
                label: "Encaissements",
                onSelect: () => router.push("/finance/payments"),
              },
              {
                id: "credit-notes",
                label: "Avoirs",
                onSelect: () => router.push("/finance/credit-notes"),
              },
              {
                id: "instruments",
                label: "Instruments",
                onSelect: () => router.push("/finance/instruments"),
              },
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
            ]}
          />
        }
      />

      <APageBody>
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
            {treasury.balancesVisible && treasury.glBankBalance != null ? (
              <Kpi
                label={`Solde GL${treasury.glBankCode ? ` ${treasury.glBankCode}` : ""}`}
                value={`${treasury.glBankBalance} ${treasury.currency}`}
              />
            ) : null}
          </div>
        ) : null}

        {state.kind === "ok" && state.accounts.length === 0 ? (
          <AEmptyState
            title="Aucun compte"
            description="Créez un compte bancaire société (RIB/IBAN libres). Pas d’annuaire inventé."
            actionLabel="Nouveau compte"
            onAction={() =>
              openAccountCreate({ code: "BQ1", label: "Compte principal" })
            }
          />
        ) : null}

        {state.kind === "ok" && state.accounts.length > 0 ? (
          <>
            <AFilterBar
              filters={
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
              }
            />

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

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  Décaissements AP
                </h3>
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setApForm({
                      vendorName: "",
                      amount: "",
                      method: "BANK_TRANSFER",
                      paymentDate: new Date().toISOString().slice(0, 10),
                      reference: "",
                    });
                    setFormError(null);
                    setApOpen(true);
                  }}
                >
                  Nouveau décaissement
                </AButton>
              </div>
              {apPayments.length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Saisir un décaissement (nom fournisseur libre) puis rapprocher
                  une ligne débit (−). Pas de facture AP ni de GL.
                </p>
              ) : (
                <div className={softTableWrap}>
                  <table className="w-full text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="px-3 py-2 font-medium">N°</th>
                        <th className="px-3 py-2 font-medium">Fournisseur</th>
                        <th className="px-3 py-2 font-medium">Montant</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                        <th className="px-3 py-2 font-medium">Banque</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apPayments.map((p) => (
                        <tr key={p.id} className={softTr}>
                          <td className="px-3 py-2 a-mono">{p.number}</td>
                          <td className="px-3 py-2">{p.vendorName}</td>
                          <td className="px-3 py-2 a-mono tabular-nums">
                            {p.amount} {p.currency}
                          </td>
                          <td className="px-3 py-2 a-mono">{p.paymentDate}</td>
                          <td className="px-3 py-2">
                            <ABadge tone={p.matched ? "success" : "neutral"}>
                              {p.matched ? "Rapproché" : "Ouvert"}
                            </ABadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <AFilterBar
              filters={
                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Filtrer les lignes"
                >
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
                      role="tab"
                      aria-selected={lineFilter === chip.id}
                      onClick={() => setLineFilter(chip.id)}
                      className={softChipClass(lineFilter === chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              }
              utilities={
                <div className="flex flex-wrap gap-2">
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
                    variant="secondary"
                    disabled={!selectedId}
                    onClick={() => {
                      setOfxText(ofxSample);
                      setOfxPreview(null);
                      setFormError(null);
                      setOfxOpen(true);
                    }}
                  >
                    Import OFX
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
              }
            />

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}

            {linesLoading ? <ASkeleton className="h-32 w-full" /> : null}

            {!linesLoading && lines.length === 0 ? (
              <AEmptyState
                title="Aucune ligne"
                description="Saisie manuelle, CSV ou OFX (FITID). + crédit / − débit."
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
                                : line.feePostedAt
                                  ? "Ignoré · GL frais"
                                  : "Ignoré"}
                          </ABadge>
                        </td>
                        <td className="px-3 py-2 a-mono text-a-fg-muted">
                          {line.match?.paymentNumber ||
                            line.match?.instrumentNumber ||
                            line.match?.apPaymentNumber ||
                            line.fitId ||
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
                              <>
                                {!line.feePostedAt &&
                                Number(line.amount) < 0 ? (
                                  <AButton
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => void onPostFee(line.id)}
                                  >
                                    Comptabiliser frais
                                  </AButton>
                                ) : null}
                                {!line.feePostedAt ? (
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
                              </>
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
      </APageBody>

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
        description="Colonnes date,amount,reference,counterparty,memo — + crédit / − débit."
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
        open={ofxOpen}
        onOpenChange={setOfxOpen}
        title="Import OFX"
        description="OFX 1.x SGML — STMTTRN + FITID obligatoire (dédup par compte)."
      >
        <div className="space-y-3">
          <textarea
            className="a-underlay a-mono min-h-[12rem] w-full rounded-md p-3 text-[length:var(--a-text-xs)] text-a-fg"
            value={ofxText}
            onChange={(e) => {
              setOfxText(e.target.value);
              setOfxPreview(null);
            }}
            spellCheck={false}
          />
          {ofxPreview ? (
            <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              {ofxPreview.lineCount} txn · {ofxPreview.duplicateFitIdCount}{" "}
              FITID déjà connus · {ofxPreview.errorCount} erreur(s)
            </p>
          ) : null}
          {ofxPreview && ofxPreview.errors.length > 0 ? (
            <ul className="text-[length:var(--a-text-xs)] text-a-warning space-y-1">
              {ofxPreview.errors.slice(0, 5).map((e) => (
                <li key={`${e.row}-${e.message}`}>
                  T{e.row}: {e.message}
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
              disabled={busy || !ofxText.trim()}
              onClick={() => void onOfxPreview()}
            >
              Prévisualiser
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !ofxText.trim()}
              onClick={() => void onOfxImport()}
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
              —{" "}
              {candidates.side === "AP"
                ? "débit : décaissements AP montant exact."
                : candidates.side === "AR"
                  ? "crédit : encaissements / instruments montant exact."
                  : "montant nul — non rapprochable."}
            </p>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            {candidates.side === "AP" ? (
            <div>
              <h4 className="mb-2 text-[length:var(--a-text-sm)] font-medium">
                Décaissements AP
              </h4>
              {(candidates.apPayments ?? []).length === 0 ? (
                <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                  Aucun décaissement POSTED non lié au même montant.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(candidates.apPayments ?? []).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-2 a-underlay rounded-md px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="a-mono text-[length:var(--a-text-sm)]">
                          {p.number}
                        </p>
                        <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                          {p.vendorName} · {p.method} · {p.paymentDate}
                        </p>
                      </div>
                      <AButton
                        type="button"
                        size="sm"
                        disabled={busy}
                        onClick={() => void onMatch({ apPaymentId: p.id })}
                      >
                        Lier
                      </AButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            ) : (
            <>
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
            </>
            )}
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={apOpen}
        onOpenChange={setApOpen}
        title="Décaissement AP"
        description="Nom fournisseur libre · montant TND positif · aucun GL."
      >
        {apForm ? (
          <div className="space-y-3">
            <Field
              label="Fournisseur"
              value={apForm.vendorName}
              onChange={(v) => setApForm({ ...apForm, vendorName: v })}
            />
            <Field
              label="Montant TND"
              value={apForm.amount}
              onChange={(v) => setApForm({ ...apForm, amount: v })}
            />
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Mode
              </span>
              <select
                className="a-underlay w-full rounded-md px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg"
                value={apForm.method}
                onChange={(e) =>
                  setApForm({ ...apForm, method: e.target.value })
                }
              >
                <option value="BANK_TRANSFER">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="CASH">Espèces</option>
                <option value="OTHER">Autre</option>
              </select>
            </label>
            <Field
              label="Date"
              type="date"
              value={apForm.paymentDate}
              onChange={(v) => setApForm({ ...apForm, paymentDate: v })}
            />
            <Field
              label="Référence"
              value={apForm.reference}
              onChange={(v) => setApForm({ ...apForm, reference: v })}
            />
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <AButton
              type="button"
              disabled={busy}
              onClick={() => void onCreateAp()}
            >
              Enregistrer
            </AButton>
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

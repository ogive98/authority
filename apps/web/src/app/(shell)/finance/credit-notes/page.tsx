"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
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
  type AComboboxOption,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  CREDIT_NOTE_STATUS_LABELS,
  cancelCreditNote,
  createCreditNote,
  creditNoteBadgeTone,
  fetchCreditNotes,
  fetchInvoices,
  issueCreditNote,
  type FinCreditNote,
  type FinInvoice,
} from "@/lib/finance";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import {
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinCreditNote[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  description: string;
  qty: string;
  unitPriceHt: string;
  taxCodeId: string;
};

type FormState = {
  invoiceId: string | null;
  invoiceLabel: string;
  copyFull: boolean;
  reason: string;
  issue: boolean;
  lines: LineDraft[];
};

function emptyLine(taxCodeId = ""): LineDraft {
  return {
    description: "",
    qty: "1",
    unitPriceHt: "",
    taxCodeId,
  };
}

function FinanceCreditNotesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillInvoiceId = searchParams.get("invoiceId");

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<FinCreditNote | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [invoiceOpts, setInvoiceOpts] = useState<AComboboxOption[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [issuedInvoices, setIssuedInvoices] = useState<FinInvoice[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefillDone = useRef(false);

  const load = useCallback(async (query?: string, invoiceId?: string | null) => {
    setState({ kind: "loading" });
    const res = await fetchCreditNotes({
      q: query,
      invoiceId: invoiceId || undefined,
    });
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

  useEffect(() => {
    void load(q, prefillInvoiceId);
  }, [load, prefillInvoiceId]);

  useEffect(() => {
    void (async () => {
      const res = await fetchTaxCodes();
      if (res.ok) setTaxCodes(res.data.items);
    })();
  }, []);

  const refreshInvoices = useCallback(async (query: string) => {
    setInvoiceLoading(true);
    const res = await fetchInvoices({ q: query, status: "ISSUED" });
    setInvoiceLoading(false);
    if (!res.ok) {
      setInvoiceOpts([]);
      setIssuedInvoices([]);
      return;
    }
    setIssuedInvoices(res.data.items);
    setInvoiceOpts(
      res.data.items.map((inv) => ({
        id: inv.id,
        label: `${inv.number} — ${inv.customerName ?? inv.customerCode ?? "—"} · ${inv.amountTotal} ${inv.currency}`,
      })),
    );
  }, []);

  function scheduleInvoiceSearch(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refreshInvoices(text);
    }, 200);
  }

  function openCreate(fromInvoice?: FinInvoice) {
    const defaultTax =
      taxCodes.find((c) => c.code === "TVA19")?.id ?? taxCodes[0]?.id ?? "";
    setFormError(null);
    setForm({
      invoiceId: fromInvoice?.id ?? null,
      invoiceLabel: fromInvoice
        ? `${fromInvoice.number} — ${fromInvoice.customerName ?? fromInvoice.customerCode ?? "—"}`
        : "",
      copyFull: true,
      reason: "",
      issue: true,
      lines: fromInvoice?.lines?.length
        ? fromInvoice.lines.map((l) => ({
            description: l.description,
            qty: l.qty,
            unitPriceHt: l.unitPriceHt,
            taxCodeId: l.taxCodeId,
          }))
        : [emptyLine(defaultTax)],
    });
    setDrawerOpen(true);
  }

  useEffect(() => {
    if (!prefillInvoiceId || prefillDone.current) return;
    void (async () => {
      const res = await fetchInvoices({ status: "ISSUED" });
      if (!res.ok) return;
      const inv = res.data.items.find((i) => i.id === prefillInvoiceId);
      if (inv) {
        prefillDone.current = true;
        openCreate(inv);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query
  }, [prefillInvoiceId, taxCodes]);

  async function submit() {
    if (!form?.invoiceId) {
      setFormError("Sélectionnez une facture émise.");
      return;
    }
    setBusy(true);
    setFormError(null);

    let body: Parameters<typeof createCreditNote>[0];
    if (form.copyFull) {
      body = {
        sourceInvoiceId: form.invoiceId,
        copyFull: true,
        reason: form.reason.trim() || undefined,
        currency: "TND",
        issue: form.issue,
      };
    } else {
      const lines = form.lines.map((l) => ({
        description: l.description.trim(),
        qty: Number(l.qty.replace(",", ".")),
        unitPriceHt: Number(l.unitPriceHt.replace(",", ".")),
        taxCodeId: l.taxCodeId,
      }));
      if (
        lines.length === 0 ||
        lines.some(
          (l) =>
            !l.description ||
            !l.taxCodeId ||
            !Number.isFinite(l.qty) ||
            l.qty <= 0 ||
            !Number.isFinite(l.unitPriceHt) ||
            l.unitPriceHt < 0,
        )
      ) {
        setBusy(false);
        setFormError(
          "Chaque ligne doit avoir description, qté, PU HT et code TVA.",
        );
        return;
      }
      body = {
        sourceInvoiceId: form.invoiceId,
        lines,
        reason: form.reason.trim() || undefined,
        currency: "TND",
        issue: form.issue,
      };
    }

    const res = await createCreditNote(body);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, prefillInvoiceId);
  }

  async function onIssue(id: string) {
    setBusy(true);
    const res = await issueCreditNote(id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, prefillInvoiceId);
  }

  async function onCancel(id: string) {
    if (!window.confirm("Annuler ce brouillon d’avoir ?")) return;
    setBusy(true);
    const res = await cancelCreditNote(id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, prefillInvoiceId);
  }

  function selectInvoice(opt: AComboboxOption) {
    const inv = issuedInvoices.find((i) => i.id === opt.id);
    if (!form) return;
    setForm({
      ...form,
      invoiceId: opt.id,
      invoiceLabel: opt.label,
      lines:
        inv?.lines?.length && !form.copyFull
          ? inv.lines.map((l) => ({
              description: l.description,
              qty: l.qty,
              unitPriceHt: l.unitPriceHt,
              taxCodeId: l.taxCodeId,
            }))
          : form.lines,
    });
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Avoirs"
        description="Avoirs liés à une facture émise — partiel ou total via lignes. Pas de restauration stock. FODEC·timbre seulement si validés."
        primary={
          <AButton type="button" size="sm" onClick={() => openCreate()}>
            {LAYOUT_ACTIONS.newCreditNote}
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "invoices",
                label: "Factures",
                onSelect: () => router.push("/finance/invoices"),
              },
              {
                id: "receivables",
                label: "Créances",
                onSelect: () => router.push("/finance"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre"]} />
        <AFilterBar
          search={
            <AInput
              id="cn-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / motif"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, prefillInvoiceId);
              }}
            />
          }
          utilities={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(q, prefillInvoiceId)}
            >
              Filtrer
            </AButton>
          }
        />

        {state.kind === "loading" ? (
          <div className="space-y-2">
            <ASkeleton className="h-10 w-full" />
            <ASkeleton className="h-10 w-full" />
          </div>
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load(q, prefillInvoiceId)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun avoir"
            description="Créez un avoir depuis une facture émise (lignes ou copie intégrale)."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full min-w-[56rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Facture</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium text-right">TTC</th>
                  <th className="a-table-cell font-medium text-right">
                    Appliqué AR
                  </th>
                  <th className="a-table-cell font-medium text-right">
                    Non appliqué
                  </th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((cn) => (
                  <tr key={cn.id} className={softTr}>
                    <td className="a-mono a-table-cell">{cn.number}</td>
                    <td className="a-mono a-table-cell">
                      {cn.invoiceNumber ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      {cn.customerName ?? cn.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={creditNoteBadgeTone(cn.status)}>
                        {CREDIT_NOTE_STATUS_LABELS[cn.status]}
                      </ABadge>
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right font-medium">
                      {cn.amountTotal} {cn.currency}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right">
                      {cn.amountAppliedToAr}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right">
                      {cn.amountUnapplied}
                    </td>
                    <td className="a-table-cell">
                      <div className="flex flex-wrap gap-2">
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetail(cn)}
                        >
                          Détail
                        </AButton>
                        {cn.status === "DRAFT" ? (
                          <>
                            <AButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => void onIssue(cn.id)}
                            >
                              Émettre
                            </AButton>
                            <AButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() => void onCancel(cn.id)}
                            >
                              Annuler
                            </AButton>
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
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvel avoir"
        description="Facture source obligatoire — lignes partielles ou copie intégrale. Cap = TTC facture."
      >
        {form ? (
          <div className="space-y-4">
            <ACombobox
              label="Facture émise"
              valueId={form.invoiceId}
              displayValue={form.invoiceLabel}
              options={invoiceOpts}
              loading={invoiceLoading}
              placeholder="Rechercher une facture…"
              onOpen={() => void refreshInvoices(form.invoiceLabel.trim())}
              onDisplayChange={(text) => {
                setForm({
                  ...form,
                  invoiceLabel: text,
                  invoiceId: null,
                });
                scheduleInvoiceSearch(text);
              }}
              onSelect={selectInvoice}
            />
            <div className="space-y-1">
              <label
                htmlFor="cn-reason"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Motif
              </label>
              <AInput
                id="cn-reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <input
                type="checkbox"
                checked={form.copyFull}
                onChange={(e) =>
                  setForm({ ...form, copyFull: e.target.checked })
                }
              />
              Copier toutes les lignes de la facture
            </label>
            {!form.copyFull ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[length:var(--a-text-sm)] font-medium">
                    Lignes
                  </p>
                  <AButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const defaultTax =
                        taxCodes.find((c) => c.code === "TVA19")?.id ??
                        taxCodes[0]?.id ??
                        "";
                      setForm({
                        ...form,
                        lines: [...form.lines, emptyLine(defaultTax)],
                      });
                    }}
                  >
                    + Ligne
                  </AButton>
                </div>
                {form.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="a-underlay space-y-2 p-[length:var(--a-space-3)]"
                  >
                    <AInput
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => {
                        const lines = [...form.lines];
                        lines[idx] = {
                          ...line,
                          description: e.target.value,
                        };
                        setForm({ ...form, lines });
                      }}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <AInput
                        className="a-mono"
                        placeholder="Qté"
                        value={line.qty}
                        onChange={(e) => {
                          const lines = [...form.lines];
                          lines[idx] = { ...line, qty: e.target.value };
                          setForm({ ...form, lines });
                        }}
                      />
                      <AInput
                        className="a-mono"
                        placeholder="PU HT"
                        value={line.unitPriceHt}
                        onChange={(e) => {
                          const lines = [...form.lines];
                          lines[idx] = {
                            ...line,
                            unitPriceHt: e.target.value,
                          };
                          setForm({ ...form, lines });
                        }}
                      />
                      <select
                        className={softSelect}
                        value={line.taxCodeId}
                        onChange={(e) => {
                          const lines = [...form.lines];
                          lines[idx] = {
                            ...line,
                            taxCodeId: e.target.value,
                          };
                          setForm({ ...form, lines });
                        }}
                      >
                        <option value="">TVA…</option>
                        {taxCodes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code}
                            {c.currentRateBps != null
                              ? ` (${formatRateBps(c.currentRateBps)})`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <input
                type="checkbox"
                checked={form.issue}
                onChange={(e) =>
                  setForm({ ...form, issue: e.target.checked })
                }
              />
              Émettre immédiatement
            </label>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <AButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDrawerOpen(false)}
              >
                Fermer
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "Création…" : "Créer"}
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={detail ? `Avoir ${detail.number}` : "Avoir"}
        description={
          detail
            ? `${detail.invoiceNumber ?? "—"} · ${CREDIT_NOTE_STATUS_LABELS[detail.status]}`
            : undefined
        }
      >
        {detail ? (
          <div className="space-y-3 text-[length:var(--a-text-sm)]">
            <p>
              Client: {detail.customerName ?? detail.customerCode ?? "—"}
            </p>
            <p className="a-mono tabular-nums">
              HT {detail.amountHt} · TVA {detail.amountTax} · TTC{" "}
              {detail.amountTotal} {detail.currency}
            </p>
            <p className="a-mono tabular-nums">
              Appliqué AR {detail.amountAppliedToAr} · Non appliqué{" "}
              {detail.amountUnapplied}
            </p>
            {detail.reason ? <p>Motif: {detail.reason}</p> : null}
            <div className={softTableWrap}>
              <table className="w-full border-collapse text-left">
                <thead className={softThead}>
                  <tr>
                    <th className="a-table-cell">Description</th>
                    <th className="a-table-cell text-right">Qté</th>
                    <th className="a-table-cell text-right">PU HT</th>
                    <th className="a-table-cell">TVA</th>
                    <th className="a-table-cell text-right">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l) => (
                    <tr key={l.id} className={softTr}>
                      <td className="a-table-cell">{l.description}</td>
                      <td className="a-mono a-table-cell tabular-nums text-right">
                        {l.qty}
                      </td>
                      <td className="a-mono a-table-cell tabular-nums text-right">
                        {l.unitPriceHt}
                      </td>
                      <td className="a-mono a-table-cell">
                        {l.taxCode ?? "—"}
                      </td>
                      <td className="a-mono a-table-cell tabular-nums text-right">
                        {l.amountTtc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

export default function FinanceCreditNotesPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinanceCreditNotesPageInner />
    </Suspense>
  );
}

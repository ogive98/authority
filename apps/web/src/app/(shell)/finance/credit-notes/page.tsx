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
  AField,
  AFilterBar,
  AForbiddenState,
  AFormSection,
  AInput,
  AListUtilities,
  AOverflowMenu,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  ATabs,
  erpListDescription,
  type AComboboxOption,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  CREDIT_NOTE_STATUS_FILTERS,
  CREDIT_NOTE_STATUS_LABELS,
  createCreditNote,
  creditNoteBadgeTone,
  fetchCreditNotes,
  fetchInvoices,
  type CreditNoteStatus,
  type FinCreditNote,
  type FinInvoice,
} from "@/lib/finance";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import { softSelect } from "@/lib/soft-glass-ui";

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

function parseStatus(raw: string | null): "" | CreditNoteStatus {
  if (raw === "DRAFT" || raw === "ISSUED" || raw === "CANCELLED") return raw;
  return "";
}

function FinanceCreditNotesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillInvoiceId = searchParams.get("invoiceId");

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CreditNoteStatus>(() =>
    parseStatus(searchParams.get("status")),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [invoiceOpts, setInvoiceOpts] = useState<AComboboxOption[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [issuedInvoices, setIssuedInvoices] = useState<FinInvoice[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefillDone = useRef(false);

  const load = useCallback(
    async (
      query?: string,
      invoiceId?: string | null,
      status?: "" | CreditNoteStatus,
    ) => {
      setState({ kind: "loading" });
      const res = await fetchCreditNotes({
        q: query,
        invoiceId: invoiceId || undefined,
        status: status || undefined,
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
    },
    [],
  );

  function syncStatusUrl(next: "" | CreditNoteStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(
      qs ? `/finance/credit-notes?${qs}` : "/finance/credit-notes",
      { scroll: false },
    );
  }

  useEffect(() => {
    void load(q, prefillInvoiceId, statusFilter);
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, prefillInvoiceId]);

  useEffect(() => {
    const next = parseStatus(searchParams.get("status"));
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, prefillInvoiceId, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    router.push(`/finance/credit-notes/${res.data.id}`);
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
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "liés à facture émise · pas de restauration stock · FODEC·timbre si validés",
        )}
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
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre", "tax.ras", "tax.tej"]} />
        <AFilterBar
          search={
            <AInput
              id="cn-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / motif"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter")
                  void load(q, prefillInvoiceId, statusFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | CreditNoteStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(q, prefillInvoiceId, next);
              }}
              items={CREDIT_NOTE_STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities
              onFilter={() => void load(q, prefillInvoiceId, statusFilter)}
            />
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
            onRetry={() => void load(q, prefillInvoiceId, statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun avoir"
            description="Créez un avoir depuis une facture émise (lignes ou copie intégrale)."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[56rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Facture</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh numeric>TTC</ASoftTh>
                <ASoftTh numeric>Appliqué AR</ASoftTh>
                <ASoftTh numeric>Non appliqué</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((cn) => (
                <ASoftTr
                  key={cn.id}
                  onClick={() =>
                    router.push(`/finance/credit-notes/${cn.id}`)
                  }
                >
                  <ASoftTd className="a-mono font-semibold">{cn.number}</ASoftTd>
                  <ASoftTd className="a-mono">
                    {cn.invoiceNumber ?? "—"}
                  </ASoftTd>
                  <ASoftTd>
                    {cn.customerName ?? cn.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd>
                    <ABadge tone={creditNoteBadgeTone(cn.status)}>
                      {CREDIT_NOTE_STATUS_LABELS[cn.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd numeric>
                    {cn.amountTotal} {cn.currency}
                  </ASoftTd>
                  <ASoftTd numeric>{cn.amountAppliedToAr}</ASoftTd>
                  <ASoftTd numeric>{cn.amountUnapplied}</ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvel avoir"
        description="Facture source obligatoire — lignes partielles ou copie intégrale. Cap = TTC facture."
      >
        {form ? (
          <div className="space-y-5">
            <AFormSection title="Facture & motif">
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
              <AField label="Motif" htmlFor="cn-reason">
                <AInput
                  id="cn-reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </AField>
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
            </AFormSection>

            {!form.copyFull ? (
              <AFormSection title="Lignes">
                <div className="flex items-center justify-end">
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
                    className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/60 p-3"
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
              </AFormSection>
            ) : null}

            <AFormSection>
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
            </AFormSection>

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

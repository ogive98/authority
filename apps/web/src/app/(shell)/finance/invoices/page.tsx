"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  type AComboboxOption,
} from "@/components/a";
import { fetchCustomers } from "@/lib/customers";
import {
  INVOICE_STATUS_LABELS,
  cancelInvoice,
  createInvoice,
  fetchInvoices,
  invoiceBadgeTone,
  issueInvoice,
  type FinInvoice,
  type InvoiceStatus,
} from "@/lib/finance";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  softChipClass,
  softPageBody,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

const STATUS_FILTERS: { id: "" | InvoiceStatus; label: string }[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "ISSUED", label: "Émise" },
  { id: "CANCELLED", label: "Annulée" },
];

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinInvoice[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  description: string;
  qty: string;
  unitPriceHt: string;
  taxCodeId: string;
};

type FormState = {
  customerId: string | null;
  customerLabel: string;
  dueDate: string;
  label: string;
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

export default function FinanceInvoicesPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | InvoiceStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (query?: string, status?: "" | InvoiceStatus) => {
      setState({ kind: "loading" });
      const res = await fetchInvoices({
        q: query,
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

  useEffect(() => {
    void load("", "");
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetchTaxCodes();
      if (res.ok) setTaxCodes(res.data.items);
    })();
  }, []);

  const refreshCustomers = useCallback(async (query: string) => {
    setCustomerLoading(true);
    const res = await fetchCustomers(query);
    setCustomerLoading(false);
    if (!res.ok) {
      setCustomerOpts([]);
      return;
    }
    setCustomerOpts(
      res.data.items.map((c) => ({
        id: c.id,
        label: `${c.code} — ${c.legalName}`,
      })),
    );
  }, []);

  function scheduleCustomerSearch(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refreshCustomers(text);
    }, 200);
  }

  function openCreate() {
    const defaultTax =
      taxCodes.find((c) => c.code === "TVA19")?.id ?? taxCodes[0]?.id ?? "";
    setFormError(null);
    setForm({
      customerId: null,
      customerLabel: "",
      dueDate: "",
      label: "",
      issue: true,
      lines: [emptyLine(defaultTax)],
    });
    setDrawerOpen(true);
  }

  async function submit() {
    if (!form?.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
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
      setFormError(
        "Chaque ligne doit avoir description, qté, PU HT et code TVA.",
      );
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createInvoice({
      customerId: form.customerId,
      lines,
      dueDate: form.dueDate || undefined,
      label: form.label.trim() || undefined,
      currency: "TND",
      issue: form.issue,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    router.push(`/finance/invoices/${res.data.id}`);
  }

  async function onIssue(invoiceId: string) {
    setBusy(true);
    const res = await issueInvoice(invoiceId);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function onCancel(invoiceId: string) {
    if (
      !window.confirm(
        "Annuler cette facture ? La créance ouverte sera clôturée et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await cancelInvoice(invoiceId);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures"
        description="Factures HT / TVA / FODEC / timbre / TTC — FODEC·timbre seulement si validés en Préférences. Soft Glass fiche D224."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/tax"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              TVA Tunisie
            </Link>
            <Link
              href="/finance"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Créances
            </Link>
            <Link
              href="/finance/credit-notes"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Avoirs
            </Link>
            <Link
              href="/finance/banking"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Banque
            </Link>
            <AButton type="button" size="sm" onClick={openCreate}>
              Nouvelle facture
            </AButton>
          </div>
        }
      />
      <div className={softPageBody}>
        <ExpertiseHintsStrip keys={["tax.fodec", "tax.timbre"]} />

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filtrer par statut"
        >
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setStatusFilter(chip.id);
                  void load(q, chip.id);
                }}
                className={softChipClass(active)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="inv-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="inv-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / libellé"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q, statusFilter)}
          >
            Filtrer
          </AButton>
        </div>

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
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune facture"
            description="Créez une facture avec lignes et codes TVA."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full min-w-[56rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium text-right">HT</th>
                  <th className="a-table-cell font-medium text-right">TVA</th>
                  <th className="a-table-cell font-medium text-right">TTC</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((inv) => (
                  <tr key={inv.id} className={softTr}>
                    <td className="a-mono a-table-cell">
                      <Link
                        href={`/finance/invoices/${inv.id}`}
                        className="font-semibold text-a-accent hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="a-table-cell">
                      {inv.customerName ?? inv.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={invoiceBadgeTone(inv.status)}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </ABadge>
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right">
                      {inv.amountHt ?? "—"}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right">
                      {inv.amountTax ?? "—"}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums text-right font-medium">
                      {inv.amountTotal} {inv.currency}
                    </td>
                    <td className="a-table-cell">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/finance/invoices/${inv.id}`}>
                          <AButton type="button" variant="secondary" size="sm">
                            Fiche
                          </AButton>
                        </Link>
                        {inv.status === "DRAFT" ? (
                          <AButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onIssue(inv.id)}
                          >
                            Émettre
                          </AButton>
                        ) : null}
                        {inv.status === "ISSUED" ? (
                          <Link
                            href={`/finance/credit-notes?invoiceId=${encodeURIComponent(inv.id)}`}
                            className="inline-flex"
                          >
                            <AButton
                              type="button"
                              variant="secondary"
                              size="sm"
                            >
                              Avoir
                            </AButton>
                          </Link>
                        ) : null}
                        {inv.status === "DRAFT" || inv.status === "ISSUED" ? (
                          <AButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => void onCancel(inv.id)}
                          >
                            Annuler
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
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle facture"
        description="Lignes HT + code TVA catalogue · FODEC/timbre si Prefs VALIDATED"
        className="max-w-xl"
      >
        {form ? (
          <div className="space-y-4">
            <ACombobox
              label="Client"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              onDisplayChange={(text) => {
                setForm({ ...form, customerLabel: text, customerId: null });
                scheduleCustomerSearch(text);
              }}
              onSelect={(opt) =>
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                })
              }
              onOpen={() => void refreshCustomers(form.customerLabel)}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Code ou raison sociale…"
              emptyText="Aucun client"
            />

            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Échéance
              </label>
              <AInput
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Libellé
              </label>
              <AInput
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-a-fg">Lignes</p>
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    setForm({
                      ...form,
                      lines: [
                        ...form.lines,
                        emptyLine(
                          taxCodes.find((c) => c.code === "TVA19")?.id ??
                            taxCodes[0]?.id ??
                            "",
                        ),
                      ],
                    })
                  }
                >
                  + Ligne
                </AButton>
              </div>
              {form.lines.map((line, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-[12px] bg-a-surface-3/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                      Ligne {idx + 1}
                    </span>
                    {form.lines.length > 1 ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setForm({
                            ...form,
                            lines: form.lines.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Retirer
                      </AButton>
                    ) : null}
                  </div>
                  <AInput
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        lines: form.lines.map((l, i) =>
                          i === idx
                            ? { ...l, description: e.target.value }
                            : l,
                        ),
                      })
                    }
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <AInput
                      placeholder="Qté"
                      value={line.qty}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx ? { ...l, qty: e.target.value } : l,
                          ),
                        })
                      }
                    />
                    <AInput
                      placeholder="PU HT"
                      value={line.unitPriceHt}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx
                              ? { ...l, unitPriceHt: e.target.value }
                              : l,
                          ),
                        })
                      }
                    />
                    <select
                      className={softSelect}
                      value={line.taxCodeId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          lines: form.lines.map((l, i) =>
                            i === idx
                              ? { ...l, taxCodeId: e.target.value }
                              : l,
                          ),
                        })
                      }
                    >
                      <option value="">TVA…</option>
                      {taxCodes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {formatRateBps(c.currentRateBps)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>

            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <input
                type="checkbox"
                checked={form.issue}
                onChange={(e) =>
                  setForm({ ...form, issue: e.target.checked })
                }
              />
              Émettre immédiatement (crée la créance AR sur TTC)
            </label>

            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDrawerOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submit()}
              >
                Créer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

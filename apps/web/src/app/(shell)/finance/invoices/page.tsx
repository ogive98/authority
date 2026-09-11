"use client";

import Link from "next/link";
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
} from "@/lib/finance";
import { fetchTaxCodes, formatRateBps, type TaxCode } from "@/lib/tax";
import { ExpertiseHintsStrip } from "@/components/expertise-hints-strip";
import {
  softPageBody,
  softSelect,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

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
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<FinInvoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchInvoices({ q: query });
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
    void load(q);
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
      setFormError("Chaque ligne doit avoir description, qté, PU HT et code TVA.");
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
    await load(q);
  }

  async function onIssue(id: string) {
    setBusy(true);
    const res = await issueInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onCancel(id: string) {
    if (
      !window.confirm(
        "Annuler cette facture ? La créance ouverte sera clôturée et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await cancelInvoice(id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures"
        description="Factures HT / TVA / FODEC / timbre / TTC — FODEC·timbre seulement si validés en Préférences."
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
                if (e.key === "Enter") void load(q);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q)}
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
            onRetry={() => void load(q)}
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
                    <td className="a-mono a-table-cell">{inv.number}</td>
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
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setDetail(inv)}
                        >
                          Détail
                        </AButton>
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
                            <AButton type="button" variant="secondary" size="sm">
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
        description="Lignes HT + code TVA Tunisie — totaux calculés côté serveur."
      >
        {form ? (
          <div className="space-y-4">
            <ACombobox
              label="Client"
              valueId={form.customerId}
              displayValue={form.customerLabel}
              options={customerOpts}
              loading={customerLoading}
              placeholder="Rechercher un client…"
              onOpen={() => void refreshCustomers(form.customerLabel.trim())}
              onDisplayChange={(text) => {
                setForm({
                  ...form,
                  customerLabel: text,
                  customerId: null,
                });
                scheduleCustomerSearch(text);
              }}
              onSelect={(opt) => {
                setForm({
                  ...form,
                  customerId: opt.id,
                  customerLabel: opt.label,
                });
              }}
            />
            <div className="space-y-1">
              <label
                htmlFor="inv-label"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Libellé
              </label>
              <AInput
                id="inv-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="inv-due"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Échéance
              </label>
              <AInput
                id="inv-due"
                type="date"
                className="a-mono"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[length:var(--a-text-sm)] font-medium">
                  Lignes
                </p>
                <AButton
                  type="button"
                  variant="secondary"
                  size="sm"
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
                  className="space-y-2 pb-3"
                >
                  <AInput
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => {
                      const lines = [...form.lines];
                      lines[idx] = { ...line, description: e.target.value };
                      setForm({ ...form, lines });
                    }}
                  />
                  <div className="grid grid-cols-2 gap-2">
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
                        lines[idx] = { ...line, unitPriceHt: e.target.value };
                        setForm({ ...form, lines });
                      }}
                    />
                  </div>
                  <select
                    className={softSelect}
                    value={line.taxCodeId}
                    onChange={(e) => {
                      const lines = [...form.lines];
                      lines[idx] = { ...line, taxCodeId: e.target.value };
                      setForm({ ...form, lines });
                    }}
                  >
                    <option value="">Code TVA…</option>
                    {taxCodes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {formatRateBps(c.currentRateBps)}
                      </option>
                    ))}
                  </select>
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

      <ADrawer
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={detail?.number ?? "Facture"}
        description="Ventilation HT / TVA / FODEC / timbre / TTC"
      >
        {detail ? (
          <div className="space-y-4 text-[length:var(--a-text-sm)]">
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">HT</dt>
                <dd className="a-mono">{detail.amountHt}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">TVA</dt>
                <dd className="a-mono">{detail.amountTax}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">FODEC</dt>
                <dd className="a-mono">
                  {detail.amountFodec ?? "0.000"}
                  {!detail.expertiseApplied?.fodec ? (
                    <span className="ml-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      (non appliqué)
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">Timbre</dt>
                <dd className="a-mono">
                  {detail.amountTimbre ?? "0.000"}
                  {!detail.expertiseApplied?.timbre ? (
                    <span className="ml-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      (non appliqué)
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-a-fg-muted">TTC</dt>
                <dd className="a-mono font-medium">
                  {detail.amountTotal} {detail.currency}
                </dd>
              </div>
            </dl>
            {(detail.lines?.length ?? 0) > 0 ? (
              <ul className="space-y-2">
                {detail.lines.map((l) => (
                  <li
                    key={l.id}
                    className="a-underlay rounded-md px-2 py-2"
                  >
                    <p>{l.description}</p>
                    <p className="a-mono text-a-fg-muted">
                      {l.qty} × {l.unitPriceHt} · {l.taxCode ?? "—"} · TTC{" "}
                      {l.amountTtc}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-a-fg-muted">Aucune ligne (facture legacy).</p>
            )}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

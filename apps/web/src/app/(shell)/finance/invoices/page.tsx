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
  createInvoice,
  fetchInvoices,
  invoiceBadgeTone,
  issueInvoice,
  type FinInvoice,
} from "@/lib/finance";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinInvoice[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

export default function FinanceInvoicesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [form, setForm] = useState<{
    customerId: string | null;
    customerLabel: string;
    amountTotal: string;
    dueDate: string;
    label: string;
    issue: boolean;
  } | null>(null);
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

  async function submit() {
    if (!form?.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
    const amount = Number(form.amountTotal.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Montant invalide.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createInvoice({
      customerId: form.customerId,
      amountTotal: amount,
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

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures"
        description="Factures commerciales — montants enregistrés tels quels (pas de calcul TVA)."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/finance"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Créances
            </Link>
            <AButton
              type="button"
              size="sm"
              onClick={() => {
                setFormError(null);
                setForm({
                  customerId: null,
                  customerLabel: "",
                  amountTotal: "",
                  dueDate: "",
                  label: "",
                  issue: true,
                });
                setDrawerOpen(true);
              }}
            >
              Nouvelle facture
            </AButton>
          </div>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
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
            description="Émettez une facture pour générer la créance AR."
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Échéance</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono a-table-cell">{inv.number}</td>
                    <td className="a-table-cell">
                      {inv.customerName ?? inv.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell">
                      <ABadge tone={invoiceBadgeTone(inv.status)}>
                        {INVOICE_STATUS_LABELS[inv.status]}
                      </ABadge>
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {inv.amountTotal} {inv.currency}
                    </td>
                    <td className="a-mono a-table-cell text-a-fg-muted">
                      {inv.dueDate ?? "—"}
                    </td>
                    <td className="a-table-cell">
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
                      ) : (
                        <span className="text-a-fg-subtle">—</span>
                      )}
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
        description="Montant enregistré tel quel — pas de TVA calculée."
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
                htmlFor="inv-amount"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Montant total (TND)
              </label>
              <AInput
                id="inv-amount"
                className="a-mono"
                value={form.amountTotal}
                onChange={(e) =>
                  setForm({ ...form, amountTotal: e.target.value })
                }
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
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
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
            <label className="flex items-center gap-2 text-[length:var(--a-text-sm)]">
              <input
                type="checkbox"
                checked={form.issue}
                onChange={(e) =>
                  setForm({ ...form, issue: e.target.checked })
                }
              />
              Émettre et créer la créance AR
            </label>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submit()}
            >
              Enregistrer
            </AButton>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

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
  POLICY_LABELS,
  confirmAllocation,
  createPayment,
  fetchPayments,
  simulateAllocation,
  type AllocationPlan,
  type AllocationPolicy,
  type FinPayment,
  type PaymentMethod,
} from "@/lib/finance";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinPayment[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: "CASH", label: "Espèces" },
  { id: "BANK_TRANSFER", label: "Virement" },
  { id: "CARD", label: "Carte" },
  { id: "CHEQUE", label: "Chèque" },
  { id: "BILL_OF_EXCHANGE", label: "Traite" },
  { id: "OTHER", label: "Autre" },
];

const POLICIES = Object.keys(POLICY_LABELS) as AllocationPolicy[];

export default function FinancePaymentsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerOpts, setCustomerOpts] = useState<AComboboxOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [form, setForm] = useState<{
    customerId: string | null;
    customerLabel: string;
    amount: string;
    method: PaymentMethod;
    paymentDate: string;
    reference: string;
    instrumentNumber: string;
    bankName: string;
    dueDate: string;
  } | null>(null);
  const [allocTarget, setAllocTarget] = useState<FinPayment | null>(null);
  const [policy, setPolicy] = useState<AllocationPolicy>("OLDEST_FIRST");
  const [plan, setPlan] = useState<AllocationPlan | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchPayments({ q: query });
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
    searchTimer.current = setTimeout(() => void refreshCustomers(text), 200);
  }

  async function submitCreate() {
    if (!form?.customerId) {
      setFormError("Sélectionnez un client.");
      return;
    }
    const amount = Number(form.amount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Montant invalide.");
      return;
    }
    const needsInst =
      form.method === "CHEQUE" || form.method === "BILL_OF_EXCHANGE";
    if (needsInst && !form.instrumentNumber.trim()) {
      setFormError("N° d’instrument requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createPayment({
      customerId: form.customerId,
      amount,
      method: form.method,
      paymentDate: form.paymentDate,
      reference: form.reference.trim() || undefined,
      currency: "TND",
      instrument: needsInst
        ? {
            type:
              form.method === "CHEQUE" ? "CHEQUE" : "BILL_OF_EXCHANGE",
            number: form.instrumentNumber.trim(),
            amount,
            bankName: form.bankName.trim() || undefined,
            dueDate: form.dueDate || undefined,
          }
        : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onSimulate() {
    if (!allocTarget) return;
    setBusy(true);
    const res = await simulateAllocation(allocTarget.id, { policy });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setPlan(res.data);
    setFormError(null);
  }

  async function onConfirm() {
    if (!allocTarget) return;
    setBusy(true);
    const res = await confirmAllocation(allocTarget.id, { policy });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setAllocOpen(false);
    setAllocTarget(null);
    setPlan(null);
    await load(q);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Encaissements"
        description="Paiements + Allocation Engine (politiques A–G) — Utility Cube."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/finance/invoices"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-fg"
            >
              Factures
            </Link>
            <AButton
              type="button"
              size="sm"
              onClick={() => {
                setFormError(null);
                setForm({
                  customerId: null,
                  customerLabel: "",
                  amount: "",
                  method: "CASH",
                  paymentDate: today,
                  reference: "",
                  instrumentNumber: "",
                  bankName: "",
                  dueDate: "",
                });
                setDrawerOpen(true);
              }}
            >
              Nouveau paiement
            </AButton>
          </div>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="pay-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="pay-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
          <ASkeleton className="h-24 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState message={state.message} retryable onRetry={() => void load(q)} />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState title="Aucun paiement" description="Enregistrez un encaissement puis simulez l’affectation." />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
            <table className="w-full min-w-[52rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                <tr>
                  <th className="a-table-cell font-medium">N°</th>
                  <th className="a-table-cell font-medium">Client</th>
                  <th className="a-table-cell font-medium">Méthode</th>
                  <th className="a-table-cell font-medium">Montant</th>
                  <th className="a-table-cell font-medium">Non affecté</th>
                  <th className="a-table-cell font-medium">Statut</th>
                  <th className="a-table-cell font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono a-table-cell">{p.number}</td>
                    <td className="a-table-cell">
                      {p.customerName ?? p.customerCode ?? "—"}
                    </td>
                    <td className="a-table-cell">{p.method}</td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {p.amount} {p.currency}
                    </td>
                    <td className="a-mono a-table-cell tabular-nums">
                      {p.amountUnallocated}
                    </td>
                    <td className="a-table-cell">
                      <ABadge
                        tone={
                          p.status === "POSTED"
                            ? "accent"
                            : p.status === "REVERSED"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {p.status}
                      </ABadge>
                    </td>
                    <td className="a-table-cell">
                      {p.status === "POSTED" &&
                      Number(p.amountUnallocated) > 0 ? (
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setAllocTarget(p);
                            setPolicy("OLDEST_FIRST");
                            setPlan(null);
                            setFormError(null);
                            setAllocOpen(true);
                          }}
                        >
                          Affecter
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
        title="Nouveau paiement"
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
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Montant (TND)
              </label>
              <AInput
                className="a-mono"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Méthode
              </label>
              <select
                className="a-input w-full rounded-[var(--a-radius-md)] border border-a-border bg-a-surface px-3 py-2 text-[13px]"
                value={form.method}
                onChange={(e) =>
                  setForm({
                    ...form,
                    method: e.target.value as PaymentMethod,
                  })
                }
              >
                {METHODS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Date
              </label>
              <AInput
                type="date"
                value={form.paymentDate}
                onChange={(e) =>
                  setForm({ ...form, paymentDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                Référence
              </label>
              <AInput
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </div>
            {(form.method === "CHEQUE" ||
              form.method === "BILL_OF_EXCHANGE") && (
              <>
                <div className="space-y-1">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    N° instrument
                  </label>
                  <AInput
                    value={form.instrumentNumber}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        instrumentNumber: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Banque
                  </label>
                  <AInput
                    value={form.bankName}
                    onChange={(e) =>
                      setForm({ ...form, bankName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Échéance instrument
                  </label>
                  <AInput
                    type="date"
                    value={form.dueDate}
                    onChange={(e) =>
                      setForm({ ...form, dueDate: e.target.value })
                    }
                  />
                </div>
              </>
            )}
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submitCreate()}
            >
              Enregistrer
            </AButton>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={allocOpen}
        onOpenChange={setAllocOpen}
        title="Allocation Engine"
        description={
          allocTarget
            ? `${allocTarget.number} — non affecté ${allocTarget.amountUnallocated} TND`
            : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
              Politique
            </label>
            <select
              className="a-input w-full rounded-[var(--a-radius-md)] border border-a-border bg-a-surface px-3 py-2 text-[13px]"
              value={policy}
              onChange={(e) => {
                setPolicy(e.target.value as AllocationPolicy);
                setPlan(null);
              }}
            >
              {POLICIES.map((p) => (
                <option key={p} value={p}>
                  {POLICY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void onSimulate()}
            >
              Simuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !plan || plan.lines.length === 0}
              onClick={() => void onConfirm()}
            >
              Confirmer
            </AButton>
          </div>
          {plan ? (
            <div className="space-y-2 text-[length:var(--a-text-sm)]">
              <p className="text-a-fg-muted">
                Reste non affecté prévu :{" "}
                <span className="a-mono tabular-nums text-a-fg">
                  {plan.remainder.toFixed(3)}
                </span>
              </p>
              <ul className="space-y-1">
                {plan.lines.map((l) => (
                  <li
                    key={l.openItemId}
                    className="flex justify-between border-b border-a-border-subtle py-1"
                  >
                    <span className="a-mono">{l.openItemNumber}</span>
                    <span className="a-mono tabular-nums">
                      {l.amount.toFixed(3)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {formError ? (
            <p className="text-[length:var(--a-text-sm)] text-a-danger">
              {formError}
            </p>
          ) : null}
        </div>
      </ADrawer>
    </>
  );
}

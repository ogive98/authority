"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  erpListDescription,
  type AComboboxOption,
} from "@/components/a";
import { fetchCustomers } from "@/lib/customers";
import {
  PAYMENT_STATUS_FILTERS,
  PAYMENT_STATUS_LABELS,
  POLICY_LABELS,
  confirmAllocation,
  createPayment,
  fetchPayments,
  paymentBadgeTone,
  reversePayment,
  simulateAllocation,
  type AllocationPlan,
  type AllocationPolicy,
  type FinPayment,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/finance";
import { softSelect } from "@/lib/soft-glass-ui";
import { ATabs } from "@/components/a/a-tabs";

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
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinancePaymentsPageInner />
    </Suspense>
  );
}

function FinancePaymentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PaymentStatus>(() => {
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "POSTED" || s === "REVERSED") return s;
    return "";
  });
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
  const axPrefillDone = useRef(false);

  const load = useCallback(
    async (query?: string, status?: "" | PaymentStatus) => {
      setState({ kind: "loading" });
      const res = await fetchPayments({
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

  function syncStatusUrl(next: "" | PaymentStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/finance/payments?${qs}` : "/finance/payments", {
      scroll: false,
    });
  }

  async function onReverse(id: string) {
    if (
      !window.confirm(
        "Contrepasser cet encaissement ? Les affectations seront annulées et le GL décomptabilisé via Thunder.",
      )
    ) {
      return;
    }
    setBusy(true);
    const res = await reversePayment(id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  useEffect(() => {
    void load("", statusFilter);
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  useEffect(() => {
    const s = searchParams.get("status");
    const next: "" | PaymentStatus =
      s === "DRAFT" || s === "POSTED" || s === "REVERSED" ? s : "";
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  /** AUTHORITY X / Thunder — open create drawer with prefill (human still submits) */
  useEffect(() => {
    if (axPrefillDone.current) return;
    const create = searchParams.get("create");
    const source = searchParams.get("source");
    if (create !== "1" && source !== "authority_x") return;

    const customerId = searchParams.get("customerId")?.trim() ?? "";
    const amount = searchParams.get("amount")?.trim() ?? "";
    const customerName = searchParams.get("customerName")?.trim() ?? "";
    const paymentDate = new Date().toISOString().slice(0, 10);

    axPrefillDone.current = true;
    setFormError(null);
    setForm({
      customerId: customerId || null,
      customerLabel: customerName,
      amount,
      method: "CASH",
      paymentDate,
      reference: source === "authority_x" ? "AUTHORITY X" : "",
      instrumentNumber: "",
      bankName: "",
      dueDate: "",
    });
    setDrawerOpen(true);
    if (customerName || customerId) {
      void refreshCustomers(customerName || customerId);
    }

    const sp = new URLSearchParams(searchParams.toString());
    sp.delete("create");
    const qs = sp.toString();
    router.replace(qs ? `/finance/payments?${qs}` : "/finance/payments", {
      scroll: false,
    });
  }, [searchParams, router, refreshCustomers]);

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
    router.push(`/finance/payments/${res.data.id}`);
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
    await load(q, statusFilter);
  }

  const today = new Date().toISOString().slice(0, 10);

  function openCreate() {
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
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Encaissements"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "affectation A–G · fiche détail · GL via Thunder",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouveau paiement
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
                id: "credit-notes",
                label: "Avoirs",
                onSelect: () => router.push("/finance/credit-notes"),
              },
              {
                id: "banking",
                label: "Banque",
                onSelect: () => router.push("/finance/banking"),
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
        <AFilterBar
          search={
            <AInput
              id="pay-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / client / référence"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | PaymentStatus;
                setStatusFilter(next);
                syncStatusUrl(next);
                void load(q, next);
              }}
              items={PAYMENT_STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
          }
        />

        {state.kind === "loading" ? (
          <ASkeleton className="h-24 w-full" />
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
            title="Aucun paiement"
            description="Enregistrez un encaissement puis ouvrez la fiche pour affecter."
            actionLabel="Nouveau paiement"
            onAction={openCreate}
          />
        ) : null}
        {state.kind === "ok" && state.items.length > 0 ? (
          <ASoftTable className="min-w-[52rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>N°</ASoftTh>
                <ASoftTh>Client</ASoftTh>
                <ASoftTh>Méthode</ASoftTh>
                <ASoftTh numeric>Montant</ASoftTh>
                <ASoftTh numeric>Non affecté</ASoftTh>
                <ASoftTh>Statut</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((p) => (
                <ASoftTr
                  key={p.id}
                  onClick={() => router.push(`/finance/payments/${p.id}`)}
                >
                  <ASoftTd>
                    <Link
                      href={`/finance/payments/${p.id}`}
                      className="a-mono font-semibold text-a-accent hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.number}
                    </Link>
                  </ASoftTd>
                  <ASoftTd>
                    {p.customerName ?? p.customerCode ?? "—"}
                  </ASoftTd>
                  <ASoftTd>{p.method}</ASoftTd>
                  <ASoftTd numeric>
                    {p.amount} {p.currency}
                  </ASoftTd>
                  <ASoftTd numeric>{p.amountUnallocated}</ASoftTd>
                  <ASoftTd>
                    <ABadge tone={paymentBadgeTone(p.status)}>
                      {PAYMENT_STATUS_LABELS[p.status]}
                    </ABadge>
                  </ASoftTd>
                  <ASoftTd>
                    <div
                      className="flex flex-wrap gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {p.status === "POSTED" &&
                      Number(p.amountUnallocated) > 0 ? (
                        <AButton
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy}
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
                      ) : null}
                      {p.status === "POSTED" ? (
                        <AButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void onReverse(p.id)}
                        >
                          Contrepasser
                        </AButton>
                      ) : null}
                      {p.status !== "POSTED" ? (
                        <span className="text-a-fg-subtle">—</span>
                      ) : null}
                    </div>
                  </ASoftTd>
                </ASoftTr>
              ))}
            </tbody>
          </ASoftTable>
        ) : null}
      </APageBody>

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
                className={softSelect}
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
              className={softSelect}
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
                    className="flex justify-between a-underlay rounded-md px-2 py-1.5"
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

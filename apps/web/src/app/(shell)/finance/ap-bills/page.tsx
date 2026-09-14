"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
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
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import {
  AP_BILL_STATUS_FILTERS,
  AP_BILL_STATUS_LABELS,
  apBillBadgeTone,
  createApBill,
  fetchApBills,
  type ApBillStatus,
  type FinApBill,
} from "@/lib/finance";
import {
  softChipClass,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FinApBill[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  vendorName: string;
  amountTotal: string;
  billDate: string;
  dueDate: string;
  label: string;
  reference: string;
  notes: string;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function FinanceApBillsPage() {
  return (
    <Suspense
      fallback={
        <APageBody>
          <ASkeleton className="h-10 w-48" />
          <ASkeleton className="h-10 w-full" />
        </APageBody>
      }
    >
      <FinanceApBillsPageInner />
    </Suspense>
  );
}

function FinanceApBillsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ApBillStatus>(() => {
    const s = searchParams.get("status");
    if (s === "DRAFT" || s === "POSTED" || s === "CANCELLED") return s;
    return "";
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const load = useCallback(
    async (query?: string, status?: "" | ApBillStatus) => {
      setState({ kind: "loading" });
      const res = await fetchApBills({
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
    void load("", statusFilter);
    // initial hydrate only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  function syncStatusUrl(next: "" | ApBillStatus) {
    const sp = new URLSearchParams(searchParams.toString());
    if (next) sp.set("status", next);
    else sp.delete("status");
    const qs = sp.toString();
    router.replace(qs ? `/finance/ap-bills?${qs}` : "/finance/ap-bills", {
      scroll: false,
    });
  }

  useEffect(() => {
    const s = searchParams.get("status");
    const next: "" | ApBillStatus =
      s === "DRAFT" || s === "POSTED" || s === "CANCELLED" ? s : "";
    if (next !== statusFilter) {
      setStatusFilter(next);
      void load(q, next);
    }
    // sync from URL only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openCreate() {
    setFormError(null);
    setForm({
      vendorName: "",
      amountTotal: "",
      billDate: todayIso(),
      dueDate: "",
      label: "",
      reference: "",
      notes: "",
    });
    setDrawerOpen(true);
  }

  async function submit() {
    if (!form) return;
    const vendorName = form.vendorName.trim();
    const amountTotal = Number(form.amountTotal.replace(",", "."));
    if (!vendorName) {
      setFormError("Saisissez le nom du fournisseur (texte libre).");
      return;
    }
    if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
      setFormError("Montant total TND doit être > 0.");
      return;
    }
    if (!form.billDate) {
      setFormError("Date de facture requise.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createApBill({
      vendorName,
      amountTotal,
      billDate: form.billDate,
      dueDate: form.dueDate || undefined,
      label: form.label.trim() || undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
      currency: "TND",
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    router.push(`/finance/ap-bills/${res.data.id}`);
  }

  return (
    <>
      <AScreenHeader
        kicker="Finance"
        title="Factures fournisseurs"
        description="Factures AP V0 — fournisseur en texte libre (pas de référentiel). Aucun GL · aucun taux inventé (D236 / D205)."
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            {LAYOUT_ACTIONS.newApBill}
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "banking",
                label: "Banque / décaissements",
                onSelect: () => router.push("/finance/banking"),
              },
              {
                id: "invoices",
                label: "Factures clients",
                onSelect: () => router.push("/finance/invoices"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="apb-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° / fournisseur / réf."
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          }
          filters={
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Filtrer par statut"
            >
              {AP_BILL_STATUS_FILTERS.map((chip) => {
                const active = statusFilter === chip.id;
                return (
                  <button
                    key={chip.id || "all"}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setStatusFilter(chip.id);
                      syncStatusUrl(chip.id);
                      void load(q, chip.id);
                    }}
                    className={softChipClass(active)}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          }
          utilities={
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void load(q, statusFilter)}
            >
              Actualiser
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
            onRetry={() => void load(q, statusFilter)}
          />
        ) : null}

        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucune facture fournisseur"
            description="Créez une facture AP en texte libre — référentiel fournisseurs plus tard."
            actionLabel={LAYOUT_ACTIONS.newApBill}
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className={softTableWrap}>
            <table className="w-full text-left text-[length:var(--a-text-sm)]">
              <thead className={softThead}>
                <tr>
                  <th className="px-3 py-2 font-medium">N°</th>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Échéance</th>
                  <th className="px-3 py-2 font-medium text-right">Montant</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((bill) => (
                  <tr
                    key={bill.id}
                    className={`${softTr} cursor-pointer`}
                    onClick={() => router.push(`/finance/ap-bills/${bill.id}`)}
                  >
                    <td className="px-3 py-2 font-mono tabular-nums">
                      <Link
                        href={`/finance/ap-bills/${bill.id}`}
                        className="text-a-accent hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {bill.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{bill.vendorName}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {bill.billDate}
                    </td>
                    <td className="px-3 py-2 font-mono tabular-nums">
                      {bill.dueDate ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {bill.amountTotal} {bill.currency}
                    </td>
                    <td className="px-3 py-2">
                      <ABadge tone={apBillBadgeTone(bill.status)}>
                        {AP_BILL_STATUS_LABELS[bill.status]}
                      </ABadge>
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
        title="Nouvelle facture fournisseur"
        description="vendorName libre — pas de master fournisseurs, pas de TVA inventée, pas de GL."
      >
        {form ? (
          <div className="space-y-3">
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            ) : null}
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Fournisseur *
              </span>
              <AInput
                value={form.vendorName}
                onChange={(e) =>
                  setForm({ ...form, vendorName: e.target.value })
                }
                placeholder="Ex. Laiterie Nord"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Montant total TND *
              </span>
              <AInput
                value={form.amountTotal}
                onChange={(e) =>
                  setForm({ ...form, amountTotal: e.target.value })
                }
                inputMode="decimal"
                placeholder="0.000"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-muted">
                  Date facture *
                </span>
                <AInput
                  type="date"
                  value={form.billDate}
                  onChange={(e) =>
                    setForm({ ...form, billDate: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[length:var(--a-text-xs)] text-a-muted">
                  Échéance
                </span>
                <AInput
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm({ ...form, dueDate: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Libellé
              </span>
              <AInput
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Référence externe
              </span>
              <AInput
                value={form.reference}
                onChange={(e) =>
                  setForm({ ...form, reference: e.target.value })
                }
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[length:var(--a-text-xs)] text-a-muted">
                Notes
              </span>
              <AInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setDrawerOpen(false)}
              >
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submit()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

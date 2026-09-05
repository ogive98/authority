"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
  fetchActiveProducts,
  fetchWarehouses,
  type InventoryWarehouse,
  type ProductOption,
} from "@/lib/inventory";
import {
  STATUS_LABELS,
  cancelSalesOrder,
  confirmSalesOrder,
  createSalesOrder,
  fetchCustomerOptions,
  fetchSalesOrders,
  type CustomerOption,
  type SalesOrder,
} from "@/lib/sales";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: SalesOrder[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  customerId: string;
  warehouseId: string;
  notes: string;
  productId: string;
  qty: string;
  unitPrice: string;
};

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

export default function SalesPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchSalesOrders(query);
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

  const loadMeta = useCallback(async () => {
    const [c, w, p] = await Promise.all([
      fetchCustomerOptions(),
      fetchWarehouses(),
      fetchActiveProducts(),
    ]);
    if (c.ok) setCustomers(c.items);
    if (w.ok) setWarehouses(w.items);
    if (p.ok) setProducts(p.items);
  }, []);

  useEffect(() => {
    void load();
    void loadMeta();
  }, [load, loadMeta]);

  function openCreate() {
    setFormError(null);
    setForm({
      customerId: customers[0]?.id ?? "",
      warehouseId: warehouses[0]?.id ?? "",
      notes: "",
      productId: products[0]?.id ?? "",
      qty: "1",
      unitPrice: "0",
    });
    setDrawerOpen(true);
  }

  async function submitCreate() {
    if (!form) return;
    const qty = Number(form.qty.replace(",", "."));
    const unitPrice = Number(form.unitPrice.replace(",", "."));
    if (!form.customerId || !form.warehouseId || !form.productId) {
      setFormError("Client, entrepôt et produit requis.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("Quantité invalide.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setFormError("Prix invalide.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createSalesOrder({
      customerId: form.customerId,
      warehouseId: form.warehouseId,
      notes: form.notes.trim() || undefined,
      lines: [{ productId: form.productId, qty, unitPrice }],
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onConfirm(row: SalesOrder) {
    const res = await confirmSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onCancel(row: SalesOrder) {
    const res = await cancelSalesOrder(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Ventes"
        title="Commandes"
        description="Brouillon → confirmation avec réserve stock (V0)."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle commande
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="so-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="so-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° commande"
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
            title="Aucune commande"
            description="Créez un brouillon puis confirmez pour réserver le stock."
            actionLabel="Nouvelle commande"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[48rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    N°
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Client
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Entrepôt
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Montant
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Statut
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                  >
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.number}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.warehouseCode ?? "—"}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.amountTotal} {row.currency}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <span
                        className={
                          row.status === "CONFIRMED"
                            ? "text-a-success"
                            : row.status === "CANCELLED"
                              ? "text-a-warning"
                              : "text-a-fg-muted"
                        }
                      >
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <div className="flex flex-wrap gap-2">
                        {row.status === "DRAFT" ? (
                          <AButton
                            type="button"
                            size="sm"
                            onClick={() => void onConfirm(row)}
                          >
                            Confirmer
                          </AButton>
                        ) : null}
                        {row.status !== "CANCELLED" ? (
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void onCancel(row)}
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
        title="Nouvelle commande"
        description="Une ligne V0 — multi-lignes en édition ultérieure"
        footer={
          <div className="flex justify-end gap-2">
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
              disabled={busy || !form}
              onClick={() => void submitCreate()}
            >
              {busy ? "…" : "Créer brouillon"}
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4 p-4">
            <Field label="Client">
              <select
                className={selectClass}
                value={form.customerId}
                onChange={(e) =>
                  setForm({ ...form, customerId: e.target.value })
                }
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.legalName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entrepôt">
              <select
                className={selectClass}
                value={form.warehouseId}
                onChange={(e) =>
                  setForm({ ...form, warehouseId: e.target.value })
                }
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Produit">
              <select
                className={selectClass}
                value={form.productId}
                onChange={(e) =>
                  setForm({ ...form, productId: e.target.value })
                }
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantité">
              <AInput
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
              />
            </Field>
            <Field label="Prix unitaire">
              <AInput
                value={form.unitPrice}
                onChange={(e) =>
                  setForm({ ...form, unitPrice: e.target.value })
                }
              />
            </Field>
            <Field label="Notes">
              <AInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-danger)]">
                {formError}
              </p>
            ) : null}
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

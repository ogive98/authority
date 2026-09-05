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
  adjustStock,
  fetchActiveProducts,
  fetchBalances,
  fetchWarehouses,
  type InventoryBalance,
  type InventoryWarehouse,
  type ProductOption,
} from "@/lib/inventory";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: InventoryBalance[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  warehouseId: string;
  productId: string;
  qtyDelta: string;
  reason: string;
};

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

export default function InventoryPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchBalances(query);
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
    const [wh, pr] = await Promise.all([
      fetchWarehouses(),
      fetchActiveProducts(),
    ]);
    if (wh.ok) setWarehouses(wh.items);
    if (pr.ok) setProducts(pr.items);
  }, []);

  useEffect(() => {
    void load();
    void loadMeta();
  }, [load, loadMeta]);

  function openAdjust(row?: InventoryBalance) {
    setFormError(null);
    setForm({
      warehouseId: row?.warehouseId ?? warehouses[0]?.id ?? "",
      productId: row?.productId ?? products[0]?.id ?? "",
      qtyDelta: "",
      reason: "",
    });
    setDrawerOpen(true);
  }

  async function submitAdjust() {
    if (!form) return;
    const qtyDelta = Number(form.qtyDelta.replace(",", "."));
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setFormError("Saisissez un écart non nul.");
      return;
    }
    if (!form.warehouseId || !form.productId) {
      setFormError("Entrepôt et produit requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await adjustStock({
      warehouseId: form.warehouseId,
      productId: form.productId,
      qtyDelta,
      reason: form.reason.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Stock"
        title="Inventaire"
        description="Soldes on-hand / reserved par entrepôt (light)."
        actions={
          <AButton type="button" size="sm" onClick={() => openAdjust()}>
            Ajuster
          </AButton>
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
              placeholder="SKU ou nom produit"
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
            title="Aucun solde"
            description="Ajustez le stock pour créer le premier solde."
            actionLabel="Ajuster"
            onAction={() => openAdjust()}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[44rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    SKU
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Produit
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Entrepôt
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    On hand
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Réservé
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Dispo
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
                      {row.productSku ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.productName ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.warehouseCode}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.onHand}
                      {row.productUom ? ` ${row.productUom}` : ""}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] text-a-fg-muted">
                      {row.reserved}
                    </td>
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.available}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <AButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => openAdjust(row)}
                      >
                        Ajuster
                      </AButton>
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
        title="Ajuster le stock"
        description="Écart positif = entrée · négatif = sortie"
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
              onClick={() => void submitAdjust()}
            >
              {busy ? "…" : "Enregistrer"}
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-4 p-4">
            <Field label="Entrepôt">
              <select
                className={selectClass}
                value={form.warehouseId}
                onChange={(e) =>
                  setForm({ ...form, warehouseId: e.target.value })
                }
              >
                {warehouses.length === 0 ? (
                  <option value="">Aucun entrepôt</option>
                ) : null}
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
                {products.length === 0 ? (
                  <option value="">Aucun produit</option>
                ) : null}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Écart quantité">
              <AInput
                value={form.qtyDelta}
                onChange={(e) =>
                  setForm({ ...form, qtyDelta: e.target.value })
                }
                placeholder="ex. 10 ou -2.5"
              />
            </Field>
            <Field label="Motif (optionnel)">
              <AInput
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
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

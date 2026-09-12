"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
import {
  adjustStock,
  fetchActiveProducts,
  fetchBalances,
  fetchWarehouses,
  type InventoryBalance,
  type InventoryWarehouse,
  type ProductOption,
} from "@/lib/inventory";
import { softList, softListRow, softSelect } from "@/lib/soft-glass-ui";

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
  lotCode: string;
  dlc: string;
};

export default function InventoryPage() {
  const router = useRouter();
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
      lotCode: "",
      dlc: "",
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
    const product = products.find((p) => p.id === form.productId);
    if (product?.trackLot && !form.lotCode.trim()) {
      setFormError("Code lot requis (produit trackLot).");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await adjustStock({
      warehouseId: form.warehouseId,
      productId: form.productId,
      qtyDelta,
      reason: form.reason.trim() || undefined,
      lotCode: form.lotCode.trim() || undefined,
      dlc: form.dlc.trim() || undefined,
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
        description="Soldes on-hand / reserved par entrepôt."
        primary={
          <AButton type="button" size="sm" onClick={() => openAdjust()}>
            Ajuster
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "certificat",
                label: "Certificat de salubrité",
                onSelect: () => router.push("/inventory/certificat-salubrite"),
              },
              {
                id: "lots",
                label: "Lots",
                onSelect: () => router.push("/inventory/lots"),
              },
            ]}
          />
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="inv-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="SKU ou nom produit"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load(q)}
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
          <ul className={softList}>
            {state.items.map((row) => (
              <li key={row.id} className={softListRow}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="a-mono text-[13px] font-semibold text-a-fg">
                      {row.productSku ?? "—"}
                    </span>
                    <span className="text-[12px] text-a-fg-subtle">
                      {row.warehouseCode}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-a-fg-muted">
                    {row.productName ?? "—"}
                  </p>
                </div>
                <div className="flex gap-4 text-right text-[13px] tabular-nums">
                  <div>
                    <p className="text-[11px] text-a-fg-subtle">On hand</p>
                    <p className="a-mono text-a-fg">
                      {row.onHand}
                      {row.productUom ? ` ${row.productUom}` : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-a-fg-subtle">Réservé</p>
                    <p className="a-mono text-a-fg-muted">{row.reserved}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-a-fg-subtle">Dispo</p>
                    <p className="a-mono font-medium text-a-fg">{row.available}</p>
                  </div>
                </div>
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openAdjust(row)}
                >
                  Ajuster
                </AButton>
              </li>
            ))}
          </ul>
        ) : null}
      </APageBody>

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
                className={softSelect}
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
                className={softSelect}
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
            {products.find((p) => p.id === form.productId)?.trackLot ? (
              <>
                <Field label="Code lot (requis)">
                  <AInput
                    value={form.lotCode}
                    onChange={(e) =>
                      setForm({ ...form, lotCode: e.target.value })
                    }
                    placeholder="LOT-2026-0001"
                  />
                </Field>
                <Field label="DLC">
                  <AInput
                    type="date"
                    value={form.dlc}
                    onChange={(e) =>
                      setForm({ ...form, dlc: e.target.value })
                    }
                  />
                </Field>
              </>
            ) : null}
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
      <label className="text-[12px] text-a-fg-subtle">{label}</label>
      {children}
    </div>
  );
}

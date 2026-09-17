"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AButton,
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
  erpListDescription,
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
import { softSelect } from "@/lib/soft-glass-ui";

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
        title="Stock"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "soldes on-hand / réservé / dispo",
        )}
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
              placeholder="Rechercher SKU, produit, entrepôt…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
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
          <ASoftTable className="min-w-[48rem]">
            <ASoftThead>
              <ASoftTr>
                <ASoftTh>SKU</ASoftTh>
                <ASoftTh>Produit</ASoftTh>
                <ASoftTh>Entrepôt</ASoftTh>
                <ASoftTh numeric>On hand</ASoftTh>
                <ASoftTh numeric>Réservé</ASoftTh>
                <ASoftTh numeric>Dispo</ASoftTh>
                <ASoftTh>Actions</ASoftTh>
              </ASoftTr>
            </ASoftThead>
            <tbody>
              {state.items.map((row) => (
                <ASoftTr key={row.id}>
                  <ASoftTd className="a-mono font-semibold">
                    {row.productSku ?? "—"}
                  </ASoftTd>
                  <ASoftTd>{row.productName ?? "—"}</ASoftTd>
                  <ASoftTd className="text-a-fg-muted">
                    {row.warehouseCode}
                  </ASoftTd>
                  <ASoftTd numeric className="a-mono tabular-nums">
                    {row.onHand}
                    {row.productUom ? ` ${row.productUom}` : ""}
                  </ASoftTd>
                  <ASoftTd
                    numeric
                    className="a-mono tabular-nums text-a-fg-muted"
                  >
                    {row.reserved}
                  </ASoftTd>
                  <ASoftTd
                    numeric
                    className="a-mono tabular-nums font-medium"
                  >
                    {row.available}
                  </ASoftTd>
                  <ASoftTd>
                    <AButton
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openAdjust(row)}
                    >
                      Ajuster
                    </AButton>
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
          <div className="space-y-5 p-4">
            <AFormSection title="Cible">
              <AField label="Entrepôt">
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
              </AField>
              <AField label="Produit">
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
              </AField>
            </AFormSection>

            {products.find((p) => p.id === form.productId)?.trackLot ? (
              <AFormSection title="Lot">
                <AField label="Code lot (requis)">
                  <AInput
                    value={form.lotCode}
                    onChange={(e) =>
                      setForm({ ...form, lotCode: e.target.value })
                    }
                    placeholder="LOT-2026-0001"
                  />
                </AField>
                <AField label="DLC">
                  <AInput
                    type="date"
                    value={form.dlc}
                    onChange={(e) =>
                      setForm({ ...form, dlc: e.target.value })
                    }
                  />
                </AField>
              </AFormSection>
            ) : null}

            <AFormSection title="Ajustement">
              <AField label="Écart quantité">
                <AInput
                  value={form.qtyDelta}
                  onChange={(e) =>
                    setForm({ ...form, qtyDelta: e.target.value })
                  }
                  placeholder="ex. 10 ou -2.5"
                />
              </AField>
              <AField label="Motif (optionnel)">
                <AInput
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </AField>
            </AFormSection>

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

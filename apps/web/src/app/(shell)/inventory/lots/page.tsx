"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
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
  adjustLot,
  createLot,
  fetchActiveProducts,
  fetchLots,
  fetchWarehouses,
  patchLotStatus,
  type InventoryLot,
  type InventoryWarehouse,
  type ProductOption,
} from "@/lib/inventory";
import { softPageBody, softSelect } from "@/lib/soft-glass-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: InventoryLot[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  warehouseId: string;
  productId: string;
  lotCode: string;
  dlc: string;
  initialQty: string;
};

function statusTone(
  status: InventoryLot["status"],
): "success" | "warning" | "neutral" {
  if (status === "OPEN") return "success";
  if (status === "QUARANTINE") return "warning";
  return "neutral";
}

function statusLabel(status: InventoryLot["status"]): string {
  if (status === "OPEN") return "Ouvert";
  if (status === "QUARANTINE") return "Quarantaine";
  return "Clos";
}

export default function InventoryLotsPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState("");

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    const res = await fetchLots({
      q: q || undefined,
      status: statusFilter,
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
  }, [q, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const [wh, pr] = await Promise.all([
        fetchWarehouses(),
        fetchActiveProducts(),
      ]);
      if (wh.ok) setWarehouses(wh.items);
      if (pr.ok) setProducts(pr.items);
    })();
  }, []);

  const openCount = useMemo(() => {
    if (state.kind !== "ok") return 0;
    return state.items.filter((i) => i.status === "OPEN").length;
  }, [state]);

  function openCreate() {
    setFormError(null);
    setForm({
      warehouseId: warehouses[0]?.id ?? "",
      productId: products[0]?.id ?? "",
      lotCode: "",
      dlc: "",
      initialQty: "",
    });
    setDrawerOpen(true);
  }

  async function submitCreate() {
    if (!form) return;
    if (!form.lotCode.trim() || !form.warehouseId || !form.productId) {
      setFormError("Entrepôt, produit et code lot requis.");
      return;
    }
    const initialQty = form.initialQty.trim()
      ? Number(form.initialQty.replace(",", "."))
      : undefined;
    if (
      initialQty != null &&
      (!Number.isFinite(initialQty) || initialQty < 0)
    ) {
      setFormError("Quantité initiale invalide.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createLot({
      warehouseId: form.warehouseId,
      productId: form.productId,
      lotCode: form.lotCode.trim(),
      dlc: form.dlc.trim() || undefined,
      initialQty,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    void load();
  }

  async function submitAdjust(lotId: string) {
    const qtyDelta = Number(adjustQty.replace(",", "."));
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      setFormError("Écart non nul requis.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await adjustLot({ lotId, qtyDelta });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setAdjustId(null);
    setAdjustQty("");
    void load();
  }

  async function setStatus(lotId: string, status: string) {
    setBusy(true);
    const res = await patchLotStatus(lotId, status);
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    void load();
  }

  return (
    <>
      <AScreenHeader
        kicker="Stock"
        title="Lots"
        description="Lots / DLC fromagerie — ajustement synchronisé avec le solde SKU."
        actions={
          <div className="flex items-center gap-3">
            <Link
              href="/inventory"
              className="text-[13px] font-medium text-a-accent hover:underline"
            >
              Inventaire →
            </Link>
            <Link
              href="/inventory/certificat-salubrite"
              className="text-[13px] font-medium text-a-accent hover:underline"
            >
              Certificat →
            </Link>
            <AButton type="button" size="sm" onClick={openCreate}>
              Nouveau lot
            </AButton>
          </div>
        }
      />

      <div className={softPageBody}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[12rem] flex-1 space-y-1">
            <span className="text-[11px] text-a-fg-subtle">Recherche</span>
            <AInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Lot, SKU, produit…"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-a-fg-subtle">Statut</span>
            <select
              className={softSelect}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Tous</option>
              <option value="OPEN">Ouverts</option>
              <option value="QUARANTINE">Quarantaine</option>
              <option value="CLOSED">Clos</option>
            </select>
          </label>
          <AButton type="button" size="sm" variant="secondary" onClick={() => void load()}>
            Actualiser
          </AButton>
        </div>

        {state.kind === "ok" ? (
          <p className="text-[12px] text-a-fg-muted">
            {state.items.length} lot(s) · {openCount} ouvert(s)
          </p>
        ) : null}

        {formError ? (
          <p className="rounded-[10px] bg-a-danger-soft px-3 py-2 text-[13px] text-a-danger-fg">
            {formError}
          </p>
        ) : null}

        {state.kind === "loading" ? (
          <ASkeleton className="h-48 w-full" />
        ) : null}
        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}
        {state.kind === "error" ? (
          <AErrorState message={state.message} retryable onRetry={() => void load()} />
        ) : null}
        {state.kind === "ok" && state.items.length === 0 ? (
          <AEmptyState
            title="Aucun lot"
            description="Créez un lot avec code + DLC pour les produits trackLot."
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <ul className="space-y-1">
            {state.items.map((lot) => (
              <li
                key={lot.id}
                className="flex flex-wrap items-center gap-3 rounded-[12px] px-3 py-3 hover:bg-a-surface-3/70"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="a-mono text-[13px] font-semibold text-a-fg">
                      {lot.lotCode}
                    </span>
                    <ABadge tone={statusTone(lot.status)}>
                      {statusLabel(lot.status)}
                    </ABadge>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-a-fg-muted">
                    {lot.productSku ?? "—"} · {lot.productName ?? "Produit"} ·{" "}
                    {lot.warehouseCode}
                    {lot.packDate ? ` · emb. ${lot.packDate}` : ""}
                    {lot.dlc ? ` · DLC ${lot.dlc}` : ""}
                  </p>
                </div>
                <div className="a-mono text-right text-[13px] tabular-nums text-a-fg">
                  {lot.qtyOnHand}
                  <span className="ml-1 text-[11px] text-a-fg-subtle">
                    {lot.productUom ?? "kg"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setAdjustId(lot.id);
                      setAdjustQty("");
                      setFormError(null);
                    }}
                  >
                    Ajuster
                  </AButton>
                  {lot.status !== "QUARANTINE" ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void setStatus(lot.id, "QUARANTINE")}
                    >
                      Quarantaine
                    </AButton>
                  ) : (
                    <AButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void setStatus(lot.id, "OPEN")}
                    >
                      Rouvrir
                    </AButton>
                  )}
                  {lot.status !== "CLOSED" ? (
                    <AButton
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void setStatus(lot.id, "CLOSED")}
                    >
                      Clôturer
                    </AButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouveau lot"
        description="Code lot + DLC optionnelle · qty initiale synchro solde."
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setDrawerOpen(false)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void submitCreate()}
            >
              Créer
            </AButton>
          </div>
        }
      >
        {form ? (
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-[12px] text-a-fg-muted">Entrepôt</span>
              <select
                className={softSelect}
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
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-a-fg-muted">Produit</span>
              <select
                className={softSelect}
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
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-a-fg-muted">Code lot</span>
              <AInput
                value={form.lotCode}
                onChange={(e) =>
                  setForm({ ...form, lotCode: e.target.value })
                }
                placeholder="LOT-2026-0001"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-a-fg-muted">DLC</span>
              <AInput
                type="date"
                value={form.dlc}
                onChange={(e) => setForm({ ...form, dlc: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-a-fg-muted">
                Quantité initiale (opt.)
              </span>
              <AInput
                value={form.initialQty}
                onChange={(e) =>
                  setForm({ ...form, initialQty: e.target.value })
                }
                placeholder="0"
              />
            </label>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={adjustId != null}
        onOpenChange={(open) => {
          if (!open) setAdjustId(null);
        }}
        title="Ajuster le lot"
        description="Écart positif ou négatif — met à jour le solde SKU."
        footer={
          <div className="flex justify-end gap-2">
            <AButton
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAdjustId(null)}
            >
              Annuler
            </AButton>
            <AButton
              type="button"
              size="sm"
              disabled={busy || !adjustId}
              onClick={() => adjustId && void submitAdjust(adjustId)}
            >
              Valider
            </AButton>
          </div>
        }
      >
        <label className="block space-y-1">
          <span className="text-[12px] text-a-fg-muted">Écart qty</span>
          <AInput
            value={adjustQty}
            onChange={(e) => setAdjustQty(e.target.value)}
            placeholder="+10 ou -2.5"
          />
        </label>
      </ADrawer>
    </>
  );
}

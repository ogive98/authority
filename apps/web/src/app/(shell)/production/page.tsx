"use client";

import { useCallback, useEffect, useState } from "react";
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
  createWorkOrder,
  declareWorkOrder,
  fetchActiveProducts,
  fetchWarehouses,
  fetchWorkOrders,
  releaseWorkOrder,
  type ProductOption,
  type WarehouseOption,
  type WorkOrder,
} from "@/lib/production";
import { cn } from "@/lib/utils";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: WorkOrder[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "create" | "declare";

const selectClass =
  "flex h-9 w-full rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2 px-3 text-[length:var(--a-text-sm)] text-a-fg";

function statusTone(
  status: string,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "DONE":
      return "success";
    case "RELEASED":
    case "IN_PROGRESS":
      return "accent";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export default function ProductionPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [selected, setSelected] = useState<WorkOrder | null>(null);

  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [plannedQty, setPlannedQty] = useState("100");
  const [lotOut, setLotOut] = useState("");
  const [mpProductId, setMpProductId] = useState("");
  const [mpQty, setMpQty] = useState("50");
  const [outputQty, setOutputQty] = useState("");
  const [declareLot, setDeclareLot] = useState("");

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchWorkOrders(query);
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
    const [pr, wh] = await Promise.all([
      fetchActiveProducts(),
      fetchWarehouses(),
    ]);
    if (pr.ok) {
      setProducts(pr.data.items);
      if (pr.data.items[0]) {
        setProductId((cur) => cur || pr.data.items[0]!.id);
        setMpProductId((cur) => cur || pr.data.items[0]!.id);
      }
    }
    if (wh.ok) {
      setWarehouses(wh.data.items);
      if (wh.data.items[0]) {
        setWarehouseId((cur) => cur || wh.data.items[0]!.id);
      }
    }
  }, []);

  useEffect(() => {
    void load();
    void loadMeta();
  }, [load, loadMeta]);

  function openCreate() {
    setDrawerMode("create");
    setFormError(null);
    setLotOut("");
    setPlannedQty("100");
    setDrawerOpen(true);
  }

  function openDeclare(row: WorkOrder) {
    setSelected(row);
    setDrawerMode("declare");
    setFormError(null);
    setOutputQty(row.plannedQty);
    setDeclareLot(row.lotOut ?? "");
    setDrawerOpen(true);
  }

  async function onCreate() {
    setBusy(true);
    setFormError(null);
    const res = await createWorkOrder({
      productId,
      warehouseId,
      plannedQty: Number(plannedQty),
      lotOut: lotOut.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onRelease(row: WorkOrder) {
    setBusy(true);
    const res = await releaseWorkOrder(row.id);
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onDeclare() {
    if (!selected) return;
    setBusy(true);
    setFormError(null);
    const res = await declareWorkOrder(selected.id, {
      consumptions: [{ productId: mpProductId, qty: Number(mpQty) }],
      outputQty: Number(outputQty),
      lotOut: declareLot.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    setSelected(null);
    await load(q);
  }

  return (
    <div className="space-y-5">
      <AScreenHeader
        kicker="Production"
        title="Ordres de fabrication"
        description="OF light — créer, libérer, déclarer conso / output (stock via Inventory)."
        actions={
          <AButton type="button" onClick={openCreate}>
            Nouvel OF
          </AButton>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <AInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher OF / lot…"
          className="max-w-xs"
        />
        <AButton
          type="button"
          variant="ghost"
          onClick={() => void load(q)}
        >
          Filtrer
        </AButton>
      </div>

      {state.kind === "loading" ? <ASkeleton className="h-48 w-full" /> : null}
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
          title="Aucun OF"
          description="Créez un ordre de fabrication pour démarrer."
          actionLabel="Nouvel OF"
          onAction={openCreate}
        />
      ) : null}

      {state.kind === "ok" && state.items.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--a-radius-lg)] border border-a-border-subtle">
          <table className="w-full min-w-[720px] text-left text-[length:var(--a-text-sm)]">
            <thead className="bg-a-surface-2 text-a-fg-muted">
              <tr>
                <th className="px-4 py-3 font-medium">OF</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Entrepôt</th>
                <th className="px-4 py-3 font-medium text-right">Planifié</th>
                <th className="px-4 py-3 font-medium text-right">Réel</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-a-border-subtle hover:bg-a-surface-2/60"
                >
                  <td className="px-4 py-3">
                    <span className="a-mono font-medium">{row.number}</span>
                    {row.lotOut ? (
                      <span className="mt-0.5 block text-[length:var(--a-text-xs)] text-a-fg-subtle">
                        Lot {row.lotOut}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className="a-mono text-a-fg-muted">
                      {row.productSku ?? "—"}
                    </span>{" "}
                    {row.productName}
                  </td>
                  <td className="px-4 py-3 a-mono">
                    {row.warehouseCode ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right a-mono a-tabular">
                    {row.plannedQty}
                  </td>
                  <td className="px-4 py-3 text-right a-mono a-tabular">
                    {row.actualQty ?? "—"}
                    {row.yieldRatio ? (
                      <span
                        className={cn(
                          "ml-2 text-[length:var(--a-text-xs)]",
                          Number(row.yieldRatio) < 0.85 ||
                            Number(row.yieldRatio) > 1.15
                            ? "text-a-danger"
                            : "text-a-fg-subtle",
                        )}
                      >
                        {(Number(row.yieldRatio) * 100).toFixed(0)}%
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <ABadge tone={statusTone(row.status)}>{row.status}</ABadge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {row.status === "PLANNED" ? (
                        <AButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void onRelease(row)}
                        >
                          Libérer
                        </AButton>
                      ) : null}
                      {row.status === "RELEASED" ||
                      row.status === "IN_PROGRESS" ? (
                        <AButton
                          type="button"
                          size="sm"
                          disabled={busy}
                          onClick={() => openDeclare(row)}
                        >
                          Déclarer
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

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawerMode === "create" ? "Nouvel OF" : "Déclaration atelier"}
      >
        <div className="space-y-4 p-1">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}

          {drawerMode === "create" ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Produit fini
                </span>
                <select
                  className={selectClass}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Entrepôt
                </span>
                <select
                  className={selectClass}
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} · {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Qté planifiée
                </span>
                <AInput
                  value={plannedQty}
                  onChange={(e) => setPlannedQty(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Lot out (optionnel)
                </span>
                <AInput
                  value={lotOut}
                  onChange={(e) => setLotOut(e.target.value)}
                />
              </label>
              <AButton
                type="button"
                className="w-full"
                disabled={busy || !productId || !warehouseId}
                onClick={() => void onCreate()}
              >
                Créer OF
              </AButton>
            </>
          ) : (
            <>
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
                {selected?.number} · consomme MP puis poste le PF en stock.
              </p>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Matière / composant
                </span>
                <select
                  className={selectClass}
                  value={mpProductId}
                  onChange={(e) => setMpProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Qté consommée
                </span>
                <AInput
                  value={mpQty}
                  onChange={(e) => setMpQty(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Qté output
                </span>
                <AInput
                  value={outputQty}
                  onChange={(e) => setOutputQty(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                  Lot out
                </span>
                <AInput
                  value={declareLot}
                  onChange={(e) => setDeclareLot(e.target.value)}
                />
              </label>
              <AButton
                type="button"
                className="w-full"
                disabled={busy || !mpProductId || !outputQty}
                onClick={() => void onDeclare()}
              >
                Poster déclaration
              </AButton>
            </>
          )}
        </div>
      </ADrawer>
    </div>
  );
}

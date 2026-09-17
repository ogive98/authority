"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
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
import { softSelect } from "@/lib/d294-ui";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: WorkOrder[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type DrawerMode = "create" | "declare";

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
  const [mpLotIn, setMpLotIn] = useState("");
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
    setMpLotIn("");
    setMpQty("50");
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
    const mp = products.find((p) => p.id === mpProductId);
    const fg = products.find((p) => p.id === selected.productId);
    if (mp?.trackLot && !mpLotIn.trim()) {
      setFormError("Lot matière (lotIn) requis — produit suivi par lot.");
      return;
    }
    if ((fg?.trackLot || selected.productSku) && !declareLot.trim()) {
      // Server enforces trackLot; UI warns when FG product known tracked or lotOut empty for cheese SKUs.
      if (fg?.trackLot) {
        setFormError("Lot out requis — produit fini suivi par lot.");
        return;
      }
    }
    setBusy(true);
    setFormError(null);
    const res = await declareWorkOrder(selected.id, {
      consumptions: [
        {
          productId: mpProductId,
          qty: Number(mpQty),
          lotIn: mpLotIn.trim() || undefined,
        },
      ],
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
    <>
      <AScreenHeader
        kicker="Production"
        title="Ordres de fabrication"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "OF light — créer, libérer, déclarer conso / output (stock via Inventory)",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvel OF
          </AButton>
        }
        more={
          <Link
            href="/production/worksheets"
            className="text-[length:var(--a-text-sm)] text-a-accent underline-offset-2 hover:underline"
          >
            Fiches digitales
          </Link>
        }
      />

      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="prod-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher OF / lot…"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q);
              }}
            />
          }
          utilities={<AListUtilities onFilter={() => void load(q)} />}
        />

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
        <ASoftTable className="min-w-[720px]">
          <ASoftThead>
            <ASoftTr>
              <ASoftTh>OF</ASoftTh>
              <ASoftTh>Produit</ASoftTh>
              <ASoftTh>Entrepôt</ASoftTh>
              <ASoftTh numeric>Planifié</ASoftTh>
              <ASoftTh numeric>Réel</ASoftTh>
              <ASoftTh>Statut</ASoftTh>
              <ASoftTh>Actions</ASoftTh>
            </ASoftTr>
          </ASoftThead>
          <tbody>
            {state.items.map((row) => (
              <ASoftTr key={row.id}>
                <ASoftTd>
                  <span className="a-mono font-medium">{row.number}</span>
                  {row.lotOut ? (
                    <span className="mt-0.5 block text-[length:var(--a-text-xs)] text-a-fg-subtle">
                      Lot {row.lotOut}
                    </span>
                  ) : null}
                </ASoftTd>
                <ASoftTd>
                  <span className="a-mono text-a-fg-muted">
                    {row.productSku ?? "—"}
                  </span>{" "}
                  {row.productName}
                </ASoftTd>
                <ASoftTd className="a-mono">
                  {row.warehouseCode ?? "—"}
                </ASoftTd>
                <ASoftTd numeric>{row.plannedQty}</ASoftTd>
                <ASoftTd numeric>
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
                </ASoftTd>
                <ASoftTd>
                  <ABadge tone={statusTone(row.status)}>{row.status}</ABadge>
                </ASoftTd>
                <ASoftTd>
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
        title={drawerMode === "create" ? "Nouvel OF" : "Déclaration atelier"}
      >
        <div className="space-y-5 p-4">
          {formError ? (
            <p className="rounded-[var(--a-radius-md)] bg-a-danger-soft px-3 py-2 text-[length:var(--a-text-sm)] text-a-danger-fg">
              {formError}
            </p>
          ) : null}

          {drawerMode === "create" ? (
            <>
              <AFormSection title="Ordre de fabrication">
                <AField label="Produit fini">
                  <select
                    className={softSelect}
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                </AField>
                <AField label="Entrepôt">
                  <select
                    className={softSelect}
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                  >
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </option>
                    ))}
                  </select>
                </AField>
                <AField label="Qté planifiée">
                  <AInput
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(e.target.value)}
                    inputMode="decimal"
                  />
                </AField>
                <AField label="Lot out (optionnel)">
                  <AInput
                    value={lotOut}
                    onChange={(e) => setLotOut(e.target.value)}
                  />
                </AField>
              </AFormSection>
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
                {selected?.number} · consomme MP puis poste le PF en stock
                (lots FEFO si trackLot).
              </p>
              <AFormSection title="Consommation MP">
                <AField label="Matière / composant">
                  <select
                    className={softSelect}
                    value={mpProductId}
                    onChange={(e) => setMpProductId(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                        {p.trackLot ? " · lot" : ""}
                      </option>
                    ))}
                  </select>
                </AField>
                <AField label="Qté consommée">
                  <AInput
                    value={mpQty}
                    onChange={(e) => setMpQty(e.target.value)}
                    inputMode="decimal"
                  />
                </AField>
                <AField
                  label="Lot matière (lotIn)"
                  required={
                    !!products.find((p) => p.id === mpProductId)?.trackLot
                  }
                >
                  <AInput
                    value={mpLotIn}
                    onChange={(e) => setMpLotIn(e.target.value)}
                    placeholder="Obligatoire si MP suivi par lot"
                  />
                </AField>
              </AFormSection>
              <AFormSection title="Output PF">
                <AField label="Qté output">
                  <AInput
                    value={outputQty}
                    onChange={(e) => setOutputQty(e.target.value)}
                    inputMode="decimal"
                  />
                </AField>
                <AField
                  label="Lot out"
                  required={
                    !!products.find((p) => p.id === selected?.productId)
                      ?.trackLot
                  }
                >
                  <AInput
                    value={declareLot}
                    onChange={(e) => setDeclareLot(e.target.value)}
                    placeholder="Code lot PF → inv_lot"
                  />
                </AField>
              </AFormSection>
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
    </>
  );
}

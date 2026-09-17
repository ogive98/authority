"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
  AContextPanel,
  ADetailGrid,
  AErrorState,
  AForbiddenState,
  AInput,
  AOverflowMenu,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftTd,
  ASoftTh,
  ASoftThead,
  ASoftTr,
  type AComboboxOption,
  type AOverflowItem,
} from "@/components/a";
import { suggestCustomerPrice } from "@/lib/customers";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { fetchWarehouses, type InventoryWarehouse } from "@/lib/inventory";
import {
  cancelSalesOrder,
  confirmSalesOrder,
  fetchIntakeSettings,
  fetchSalesOrder,
  searchProducts,
  updateSalesOrder,
  type SalesFulfillmentStatus,
  type SalesIntakeSettings,
  type SalesOrder,
  type SalesOrderStatus,
} from "@/lib/sales";
import { useStatusLabel } from "@/hooks/use-status-label";

function orderBadgeTone(
  status: SalesOrderStatus,
): "success" | "warning" | "neutral" {
  if (status === "CONFIRMED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

function fulfillmentBadgeTone(
  status: SalesFulfillmentStatus,
): "success" | "accent" | "neutral" {
  if (status === "FULL") return "success";
  if (status === "PARTIAL") return "accent";
  return "neutral";
}

function fulfillmentLabel(status: SalesFulfillmentStatus): string {
  if (status === "FULL") return "Livré";
  if (status === "PARTIAL") return "Partiel";
  return "Non livré";
}

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: SalesOrder }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type LineDraft = {
  key: string;
  productId: string | null;
  productLabel: string;
  qty: string;
  unitPrice: string;
};

export default function SalesOrderFichePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { label: st } = useStatusLabel();
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SalesIntakeSettings | null>(null);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);

  const [requestedDate, setRequestedDate] = useState("");
  const [preferredDriver, setPreferredDriver] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [productOptsByKey, setProductOptsByKey] = useState<
    Record<string, AComboboxOption[]>
  >({});
  const [productLoadingKey, setProductLoadingKey] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!id) {
      setState({ kind: "error", message: "Identifiant manquant." });
      return;
    }
    setState({ kind: "loading" });
    const res = await fetchSalesOrder(id);
    if (!res.ok) {
      if (res.status === 403) {
        setState({ kind: "forbidden", message: res.message });
        return;
      }
      setState({
        kind: "error",
        message: res.status === 404 ? "Commande introuvable." : res.message,
      });
      return;
    }
    setState({ kind: "ok", data: res.data });
    setRequestedDate(res.data.requestedDate ?? "");
    setPreferredDriver(res.data.preferredDriver ?? "");
    setNotes(res.data.notes ?? "");
    setLines(
      res.data.lines.map((l) => ({
        key: l.id,
        productId: l.productId,
        productLabel:
          l.productSku && l.productName
            ? `${l.productSku} — ${l.productName}`
            : l.productName ?? l.productSku ?? l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
      })),
    );
    setEditing(false);
    setError(null);
  }, [id]);

  useEffect(() => {
    void load();
    void (async () => {
      const [s, w] = await Promise.all([
        fetchIntakeSettings(),
        fetchWarehouses(),
      ]);
      if (s.ok) setSettings(s.data);
      if (w.ok) setWarehouses(w.items);
    })();
  }, [load]);

  function searchProductForLine(lineKey: string, text: string) {
    setProductLoadingKey(lineKey);
    void searchProducts(text).then((res) => {
      setProductLoadingKey((k) => (k === lineKey ? null : k));
      if (!res.ok) {
        setProductOptsByKey((m) => ({ ...m, [lineKey]: [] }));
        return;
      }
      setProductOptsByKey((m) => ({
        ...m,
        [lineKey]: res.items.map((p) => ({
          id: p.id,
          label: `${p.sku} — ${p.name}`,
        })),
      }));
    });
  }

  async function onConfirm() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await confirmSalesOrder(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
  }

  async function onCancelOrder() {
    if (!id) return;
    setBusy(true);
    setError(null);
    const res = await cancelSalesOrder(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    setEditing(false);
  }

  async function onSaveDraft() {
    if (state.kind !== "ok" || state.data.status !== "DRAFT") return;
    const lineInputs = lines
      .filter((l) => l.productId)
      .map((l) => ({
        productId: l.productId!,
        qty: Number(l.qty),
        unitPrice: Number(l.unitPrice),
      }));
    if (lineInputs.length === 0) {
      setError("Au moins une ligne produit.");
      return;
    }
    if (settings?.requireRequestedDate && !requestedDate) {
      setError("Date demandée requise (paramètre société).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await updateSalesOrder(id, {
      version: state.data.version,
      requestedDate: requestedDate || null,
      preferredDriver: preferredDriver.trim() || null,
      notes: notes.trim() || null,
      lines: lineInputs,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setState({ kind: "ok", data: res.data });
    setEditing(false);
  }

  const order = state.kind === "ok" ? state.data : null;
  const warehouseLabel =
    order &&
    (warehouses.find((w) => w.id === order.warehouseId)
      ? `${warehouses.find((w) => w.id === order.warehouseId)!.code} — ${warehouses.find((w) => w.id === order.warehouseId)!.name}`
      : order.warehouseCode);

  const overflowItems = useMemo((): AOverflowItem[] => {
    if (!order) return [];
    const items: AOverflowItem[] = [];
    if (order.status === "DRAFT" && !editing) {
      items.push({
        id: "edit",
        label: LAYOUT_ACTIONS.edit,
        onSelect: () => setEditing(true),
        disabled: busy,
      });
    }
    if (order.status === "DRAFT" && editing) {
      items.push({
        id: "cancel-edit",
        label: "Annuler édition",
        onSelect: () => void load(),
        disabled: busy,
      });
    }
    if (order.status !== "CANCELLED") {
      items.push({
        id: "cancel-order",
        label: "Annuler commande",
        danger: true,
        onSelect: () => void onCancelOrder(),
        disabled: busy,
      });
    }
    return items;
  }, [order, editing, busy, load]);

  return (
    <>
      <AScreenHeader
        breadcrumb={
          <Link href="/sales" className="hover:text-a-fg">
            Commandes
          </Link>
        }
        kicker="Ventes"
        title={order ? order.number : "Commande"}
        description="Fiche — lecture · édition brouillon · confirm/annuler (D223)."
        status={
          order ? (
            <ABadge tone={orderBadgeTone(order.status)}>
              {st(order.status)}
            </ABadge>
          ) : undefined
        }
        primary={
          order?.status === "DRAFT" && editing ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onSaveDraft()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          ) : order?.status === "DRAFT" && !editing ? (
            <AButton
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void onConfirm()}
            >
              {LAYOUT_ACTIONS.confirm}
            </AButton>
          ) : undefined
        }
        more={
          overflowItems.length > 0 ? (
            <AOverflowMenu items={overflowItems} />
          ) : undefined
        }
      />

      <APageBody>
        {error ? (
          <p className="text-[length:var(--a-text-sm)] text-a-danger">{error}</p>
        ) : null}

        {state.kind === "loading" ? (
          <div className="space-y-3">
            <ASkeleton className="h-8 w-48" />
            <ASkeleton className="h-40 w-full" />
          </div>
        ) : null}

        {state.kind === "forbidden" ? (
          <AForbiddenState message={state.message} />
        ) : null}

        {state.kind === "error" ? (
          <AErrorState
            message={state.message}
            retryable
            onRetry={() => void load()}
          />
        ) : null}

        {order ? (
          <ADetailGrid
            primary={
              <>
                <APageSection title="Identité">
                  <span className="mb-3 inline-block a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                    v{order.version}
                  </span>
                  <dl className="grid gap-3 text-[length:var(--a-text-sm)] sm:grid-cols-2">
                    <div>
                      <dt className="text-a-fg-muted">Client</dt>
                      <dd>
                        {order.customerName ?? "—"}{" "}
                        <span className="a-mono text-a-fg-muted">
                          {order.customerCode}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Entrepôt</dt>
                      <dd>{warehouseLabel ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Date demandée</dt>
                      <dd>
                        {editing ? (
                          <AInput
                            type="date"
                            value={requestedDate}
                            onChange={(e) => setRequestedDate(e.target.value)}
                          />
                        ) : (
                          <span className="a-mono">
                            {order.requestedDate ?? "—"}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-a-fg-muted">Livreur souhaité</dt>
                      <dd>
                        {editing ? (
                          <AInput
                            value={preferredDriver}
                            onChange={(e) => setPreferredDriver(e.target.value)}
                          />
                        ) : (
                          order.preferredDriver ?? "—"
                        )}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-a-fg-muted">Notes</dt>
                      <dd>
                        {editing ? (
                          <AInput
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                          />
                        ) : (
                          order.notes ?? "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                </APageSection>

                <APageSection
                  title="Lignes"
                  action={
                    editing ? (
                      <AButton
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setLines((prev) => [
                            ...prev,
                            {
                              key: `l-${Date.now()}`,
                              productId: null,
                              productLabel: "",
                              qty: "1",
                              unitPrice: "0",
                            },
                          ])
                        }
                      >
                        + Ligne
                      </AButton>
                    ) : undefined
                  }
                >
                  {editing ? (
                    <div className="space-y-3">
                      {lines.map((line, idx) => (
                        <div
                          key={line.key}
                          className="space-y-2 rounded-[var(--a-radius-sm)] bg-a-surface-3/60 p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                              Ligne {idx + 1}
                            </span>
                            {lines.length > 1 ? (
                              <AButton
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setLines((prev) =>
                                    prev.filter((l) => l.key !== line.key),
                                  )
                                }
                              >
                                Retirer
                              </AButton>
                            ) : null}
                          </div>
                          <ACombobox
                            label="Produit"
                            valueId={line.productId}
                            displayValue={line.productLabel}
                            onDisplayChange={(text) => {
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key
                                    ? {
                                        ...l,
                                        productLabel: text,
                                        productId: null,
                                      }
                                    : l,
                                ),
                              );
                              searchProductForLine(line.key, text);
                            }}
                            onSelect={(opt) => {
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === line.key
                                    ? {
                                        ...l,
                                        productId: opt.id,
                                        productLabel: opt.label,
                                      }
                                    : l,
                                ),
                              );
                              void suggestCustomerPrice(
                                order.customerId,
                                opt.id,
                              ).then((priceRes) => {
                                if (
                                  !priceRes.ok ||
                                  priceRes.data.unitPrice == null
                                )
                                  return;
                                setLines((prev) =>
                                  prev.map((l) =>
                                    l.key === line.key
                                      ? {
                                          ...l,
                                          unitPrice: String(
                                            priceRes.data.unitPrice,
                                          ),
                                        }
                                      : l,
                                  ),
                                );
                              });
                            }}
                            onOpen={() =>
                              searchProductForLine(line.key, line.productLabel)
                            }
                            options={productOptsByKey[line.key] ?? []}
                            loading={productLoadingKey === line.key}
                            placeholder="SKU ou nom…"
                            emptyText="Aucun produit"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                Qté
                              </label>
                              <AInput
                                value={line.qty}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key
                                        ? { ...l, qty: e.target.value }
                                        : l,
                                    ),
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                PU
                              </label>
                              <AInput
                                value={line.unitPrice}
                                disabled={settings?.allowManualPrice === false}
                                onChange={(e) =>
                                  setLines((prev) =>
                                    prev.map((l) =>
                                      l.key === line.key
                                        ? { ...l, unitPrice: e.target.value }
                                        : l,
                                    ),
                                  )
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ASoftTable>
                      <ASoftThead>
                        <ASoftTr>
                          <ASoftTh>#</ASoftTh>
                          <ASoftTh>Produit</ASoftTh>
                          <ASoftTh numeric>Qté</ASoftTh>
                          <ASoftTh numeric>Livré</ASoftTh>
                          <ASoftTh numeric>Reste</ASoftTh>
                          <ASoftTh numeric>PU</ASoftTh>
                          <ASoftTh numeric>Total</ASoftTh>
                        </ASoftTr>
                      </ASoftThead>
                      <tbody>
                        {order.lines.map((l) => (
                          <ASoftTr key={l.id}>
                            <ASoftTd className="a-mono">{l.lineNo}</ASoftTd>
                            <ASoftTd>
                              <span className="a-mono text-a-fg-muted">
                                {l.productSku}
                              </span>{" "}
                              {l.productName}
                            </ASoftTd>
                            <ASoftTd numeric>{l.qty}</ASoftTd>
                            <ASoftTd numeric>
                              {l.deliveredQty ?? "0"}
                            </ASoftTd>
                            <ASoftTd numeric>
                              {l.remainingQty ?? l.qty}
                            </ASoftTd>
                            <ASoftTd numeric>{l.unitPrice}</ASoftTd>
                            <ASoftTd numeric>{l.lineTotal}</ASoftTd>
                          </ASoftTr>
                        ))}
                      </tbody>
                    </ASoftTable>
                  )}
                </APageSection>
              </>
            }
            context={
              <AContextPanel title="Synthèse">
                <dl className="space-y-3 text-[length:var(--a-text-sm)]">
                  <div>
                    <dt className="text-a-fg-muted">Total</dt>
                    <dd className="a-mono a-tabular text-[length:var(--a-text-base)] font-medium">
                      {order.amountTotal} {order.currency}
                    </dd>
                  </div>
                  {order.status === "CONFIRMED" && order.fulfillmentStatus ? (
                    <div>
                      <dt className="mb-1 text-a-fg-muted">Livraison</dt>
                      <dd>
                        <ABadge
                          tone={fulfillmentBadgeTone(order.fulfillmentStatus)}
                        >
                          {fulfillmentLabel(order.fulfillmentStatus)}
                        </ABadge>
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {order.status === "CONFIRMED" ? (
                  <p className="mt-4 text-[length:var(--a-text-sm)] text-a-fg-muted">
                    Livraison / FEFO : module Delivery.{" "}
                    <button
                      type="button"
                      className="font-medium text-a-accent hover:underline"
                      onClick={() => router.push("/delivery")}
                    >
                      Ouvrir Delivery
                    </button>
                  </p>
                ) : null}
              </AContextPanel>
            }
          />
        ) : null}
      </APageBody>
    </>
  );
}

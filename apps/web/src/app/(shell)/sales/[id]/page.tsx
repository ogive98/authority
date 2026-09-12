"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  type AComboboxOption,
} from "@/components/a";
import { suggestCustomerPrice } from "@/lib/customers";
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
import {
  softPageBody,
  softPanel,
  softTableWrap,
  softThead,
  softTr,
} from "@/lib/soft-glass-ui";
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

  return (
    <>
      <AScreenHeader
        kicker="Ventes"
        title={order ? order.number : "Commande"}
        description="Fiche Soft Glass — lecture · édition brouillon · confirm/annuler (D223)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sales"
              className="inline-flex items-center rounded-[var(--a-radius-md)] bg-a-surface-3 px-3 py-1.5 text-[length:var(--a-text-sm)] font-medium text-a-fg hover:opacity-90"
            >
              Retour
            </Link>
            {order?.status === "DRAFT" && !editing ? (
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                Modifier
              </AButton>
            ) : null}
            {order?.status === "DRAFT" && editing ? (
              <>
                <AButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void load()}
                >
                  Annuler édition
                </AButton>
                <AButton
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onSaveDraft()}
                >
                  Enregistrer
                </AButton>
              </>
            ) : null}
            {order?.status === "DRAFT" && !editing ? (
              <AButton
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void onConfirm()}
              >
                Confirmer
              </AButton>
            ) : null}
            {order && order.status !== "CANCELLED" ? (
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void onCancelOrder()}
              >
                Annuler commande
              </AButton>
            ) : null}
          </div>
        }
      />

      <div className={softPageBody}>
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
          <>
            <section className={`${softPanel} space-y-4 p-5`}>
              <div className="flex flex-wrap items-center gap-2">
                <ABadge tone={orderBadgeTone(order.status)}>
                  {st(order.status)}
                </ABadge>
                {order.status === "CONFIRMED" && order.fulfillmentStatus ? (
                  <ABadge tone={fulfillmentBadgeTone(order.fulfillmentStatus)}>
                    {fulfillmentLabel(order.fulfillmentStatus)}
                  </ABadge>
                ) : null}
                <span className="a-mono text-[length:var(--a-text-sm)] text-a-fg-muted">
                  v{order.version}
                </span>
              </div>

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
                <div>
                  <dt className="text-a-fg-muted">Total</dt>
                  <dd className="a-mono tabular-nums text-[length:var(--a-text-base)] font-semibold">
                    {order.amountTotal} {order.currency}
                  </dd>
                </div>
              </dl>
            </section>

            <section className={`${softPanel} overflow-hidden`}>
              <div className="flex items-center justify-between px-5 py-3">
                <h2 className="text-[length:var(--a-text-sm)] font-semibold text-a-fg">
                  Lignes
                </h2>
                {editing ? (
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
                ) : null}
              </div>

              {editing ? (
                <div className="space-y-3 px-5 pb-5">
                  {lines.map((line, idx) => (
                    <div
                      key={line.key}
                      className="space-y-2 rounded-[12px] bg-a-surface-3/60 p-3"
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
                <div className={softTableWrap}>
                  <table className="w-full text-left text-[length:var(--a-text-sm)]">
                    <thead className={softThead}>
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Produit</th>
                        <th className="px-4 py-3 font-medium text-right">Qté</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Livré
                        </th>
                        <th className="px-4 py-3 font-medium text-right">
                          Reste
                        </th>
                        <th className="px-4 py-3 font-medium text-right">PU</th>
                        <th className="px-4 py-3 font-medium text-right">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map((l) => (
                        <tr key={l.id} className={softTr}>
                          <td className="a-mono px-4 py-3">{l.lineNo}</td>
                          <td className="px-4 py-3">
                            <span className="a-mono text-a-fg-muted">
                              {l.productSku}
                            </span>{" "}
                            {l.productName}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.qty}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.deliveredQty ?? "0"}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.remainingQty ?? l.qty}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.unitPrice}
                          </td>
                          <td className="a-mono px-4 py-3 text-right tabular-nums">
                            {l.lineTotal}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {order.status === "CONFIRMED" ? (
              <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
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
          </>
        ) : null}
      </div>
    </>
  );
}

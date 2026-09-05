"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AButton,
  ACombobox,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  AScreenHeader,
  ASkeleton,
  type AComboboxOption,
} from "@/components/a";
import {
  SHIPMENT_STATUS_LABELS,
  assignShipmentDriver,
  completeShipment,
  createShipment,
  dispatchShipment,
  failShipment,
  fetchEligibleOrders,
  fetchShipments,
  type DeliveryShipment,
  type EligibleOrder,
} from "@/lib/delivery";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: DeliveryShipment[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  orderId: string | null;
  orderLabel: string;
  driverLabel: string;
};

function statusClass(status: DeliveryShipment["status"]): string {
  if (status === "DELIVERED") return "text-a-success";
  if (status === "FAILED") return "text-a-warning";
  if (status === "OUT") return "text-a-accent";
  return "text-a-fg-muted";
}

function orderToOption(o: EligibleOrder): AComboboxOption {
  return {
    id: o.id,
    label: `${o.number} — ${o.customerName ?? o.customerCode ?? "Client"}`,
    hint: o.preferredDriver
      ? `Livreur hint: ${o.preferredDriver}`
      : `${o.lineCount} ligne(s)`,
  };
}

export default function DeliveryPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderOpts, setOrderOpts] = useState<AComboboxOption[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [eligibleCache, setEligibleCache] = useState<EligibleOrder[]>([]);
  const [assignDraft, setAssignDraft] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string) => {
    setState({ kind: "loading" });
    const res = await fetchShipments(query);
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

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setFormError(null);
    setForm({ orderId: null, orderLabel: "", driverLabel: "" });
    setOrderOpts([]);
    setDrawerOpen(true);
  }

  const refreshOrders = useCallback(async (query: string) => {
    setOrderLoading(true);
    const res = await fetchEligibleOrders(query);
    setOrderLoading(false);
    if (!res.ok) {
      setOrderOpts([]);
      setEligibleCache([]);
      return;
    }
    setEligibleCache(res.items);
    setOrderOpts(res.items.map(orderToOption));
  }, []);

  function scheduleOrderSearch(text: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void refreshOrders(text);
    }, 200);
  }

  async function submitCreate() {
    if (!form?.orderId) {
      setFormError("Sélectionnez une commande confirmée.");
      return;
    }
    setBusy(true);
    setFormError(null);
    const res = await createShipment({
      orderId: form.orderId,
      driverLabel: form.driverLabel.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q);
  }

  async function onAssign(row: DeliveryShipment) {
    const label = (assignDraft[row.id] ?? row.driverLabel ?? "").trim();
    if (!label) return;
    const res = await assignShipmentDriver(row.id, label);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onDispatch(row: DeliveryShipment) {
    const res = await dispatchShipment(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onComplete(row: DeliveryShipment) {
    const res = await completeShipment(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  async function onFail(row: DeliveryShipment) {
    const res = await failShipment(row.id, "Échec livraison desk");
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q);
  }

  return (
    <>
      <AScreenHeader
        kicker="Logistique"
        title="Livraisons"
        description="Expéditions depuis commandes confirmées — livreur, en route, livré / échec (stock issue / release)."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle livraison
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label
              htmlFor="dlv-q"
              className="text-[length:var(--a-text-sm)] text-a-fg-muted"
            >
              Recherche
            </label>
            <AInput
              id="dlv-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° livraison / livreur"
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
            title="Aucune livraison"
            description="Créez une expédition à partir d’une commande confirmée, assignez le livreur, puis livrez ou marquez l’échec."
            actionLabel="Nouvelle livraison"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0 ? (
          <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle">
            <table className="w-full min-w-[52rem] border-collapse text-left text-[length:var(--a-text-sm)]">
              <thead className="border-b border-a-border-subtle bg-a-surface-2 text-a-fg-muted">
                <tr>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    N°
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Commande
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Client
                  </th>
                  <th className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)] font-medium">
                    Livreur
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
                    <td className="a-mono px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.orderNumber ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.customerName ?? row.customerCode ?? "—"}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      {row.status === "READY" || row.status === "ASSIGNED" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <AInput
                            value={
                              assignDraft[row.id] ?? row.driverLabel ?? ""
                            }
                            onChange={(e) =>
                              setAssignDraft({
                                ...assignDraft,
                                [row.id]: e.target.value,
                              })
                            }
                            placeholder={
                              row.preferredDriver
                                ? `hint: ${row.preferredDriver}`
                                : "Livreur"
                            }
                          />
                          <AButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void onAssign(row)}
                          >
                            Assigner
                          </AButton>
                        </div>
                      ) : (
                        row.driverLabel ?? "—"
                      )}
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <span className={statusClass(row.status)}>
                        {SHIPMENT_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-[var(--a-table-cell-px)] py-[var(--a-table-cell-py)]">
                      <div className="flex flex-wrap gap-2">
                        {(row.status === "READY" ||
                          row.status === "ASSIGNED") &&
                        row.driverLabel ? (
                          <AButton
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void onDispatch(row)}
                          >
                            En route
                          </AButton>
                        ) : null}
                        {row.status === "READY" ||
                        row.status === "ASSIGNED" ||
                        row.status === "OUT" ? (
                          <>
                            <AButton
                              type="button"
                              size="sm"
                              onClick={() => void onComplete(row)}
                            >
                              Livré
                            </AButton>
                            <AButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => void onFail(row)}
                            >
                              Échec
                            </AButton>
                          </>
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
        onClose={() => setDrawerOpen(false)}
        title="Nouvelle livraison"
        description="Choisir une commande confirmée sans expédition."
      >
        {form ? (
          <div className="space-y-[var(--a-space-4)]">
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {formError}
              </p>
            ) : null}

            <ACombobox
              label="Commande confirmée"
              valueId={form.orderId}
              displayValue={form.orderLabel}
              onDisplayChange={(text) => {
                setForm({
                  ...form,
                  orderLabel: text,
                  orderId: null,
                });
                scheduleOrderSearch(text);
              }}
              onSelect={(opt) => {
                const match = eligibleCache.find((o) => o.id === opt.id);
                setForm({
                  ...form,
                  orderId: opt.id,
                  orderLabel: opt.label,
                  driverLabel:
                    form.driverLabel.trim() ||
                    match?.preferredDriver ||
                    "",
                });
              }}
              onOpen={() => void refreshOrders(form.orderLabel.trim())}
              options={orderOpts}
              loading={orderLoading}
              placeholder="N° commande…"
              emptyText="Aucune commande confirmée disponible"
            />

            <div className="space-y-1">
              <label
                htmlFor="dlv-driver"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Livreur
              </label>
              <AInput
                id="dlv-driver"
                value={form.driverLabel}
                onChange={(e) =>
                  setForm({ ...form, driverLabel: e.target.value })
                }
                placeholder="Nom du livreur"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDrawerOpen(false)}
                disabled={busy}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                onClick={() => void submitCreate()}
                disabled={busy}
              >
                Créer
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABadge,
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
  type ShipmentStatus,
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

type FailDraft = { id: string; number: string; reason: string };

const STATUS_FILTERS: Array<{ id: "" | ShipmentStatus; label: string }> = [
  { id: "", label: "Tous" },
  { id: "READY", label: "Prêt" },
  { id: "ASSIGNED", label: "Assigné" },
  { id: "OUT", label: "En route" },
  { id: "DELIVERED", label: "Livré" },
  { id: "FAILED", label: "Échec" },
];

function shipmentBadgeTone(
  status: DeliveryShipment["status"],
): "success" | "warning" | "accent" | "neutral" | "info" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "OUT") return "accent";
  if (status === "ASSIGNED") return "info";
  return "neutral";
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

function tourneeKey(row: DeliveryShipment): string {
  const day = row.createdAt.slice(0, 10);
  const driver = row.driverLabel?.trim() || "Sans livreur";
  return `${day} · ${driver}`;
}

export default function DeliveryPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ShipmentStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [orderOpts, setOrderOpts] = useState<AComboboxOption[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [eligibleCache, setEligibleCache] = useState<EligibleOrder[]>([]);
  const [assignDraft, setAssignDraft] = useState<Record<string, string>>({});
  const [failDraft, setFailDraft] = useState<FailDraft | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (query?: string, status?: "" | ShipmentStatus) => {
    setState({ kind: "loading" });
    const res = await fetchShipments({
      q: query,
      status: status || undefined,
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
  }, []);

  useEffect(() => {
    void load(q, statusFilter);
  }, [load, statusFilter]);

  const tourneeGroups = useMemo(() => {
    if (state.kind !== "ok") return [];
    const map = new Map<string, DeliveryShipment[]>();
    for (const row of state.items) {
      const key = tourneeKey(row);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [state]);

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
    await load(q, statusFilter);
  }

  async function onAssign(row: DeliveryShipment) {
    const label = (assignDraft[row.id] ?? row.driverLabel ?? "").trim();
    if (!label) return;
    const res = await assignShipmentDriver(row.id, label);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function onDispatch(row: DeliveryShipment) {
    const res = await dispatchShipment(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function onComplete(row: DeliveryShipment) {
    const res = await completeShipment(row.id);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    await load(q, statusFilter);
  }

  async function submitFail() {
    if (!failDraft) return;
    setBusy(true);
    const res = await failShipment(
      failDraft.id,
      failDraft.reason.trim() || "Échec livraison desk",
    );
    setBusy(false);
    if (!res.ok) {
      setState({ kind: "error", message: res.message });
      return;
    }
    setFailDraft(null);
    await load(q, statusFilter);
  }

  return (
    <>
      <AScreenHeader
        kicker="Logistique"
        title="Tournées"
        description="Bureau livraisons — filtre statut, regroupement livreur/jour, stock issue / release."
        actions={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle livraison
          </AButton>
        }
      />
      <div className="space-y-[var(--a-space-5)] p-[var(--a-space-6)]">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                onClick={() => setStatusFilter(chip.id)}
                className={
                  active
                    ? "rounded-full border border-a-accent bg-a-accent-muted px-3 py-1 text-[length:var(--a-text-xs)] font-medium text-a-accent"
                    : "rounded-full border border-a-border-subtle bg-a-surface-2 px-3 py-1 text-[length:var(--a-text-xs)] text-a-fg-muted hover:border-a-accent/40 hover:text-a-fg"
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>

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
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load(q, statusFilter)}
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
            onRetry={() => void load(q, statusFilter)}
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

        {state.kind === "ok" && state.items.length > 0
          ? tourneeGroups.map(([groupLabel, rows]) => (
              <div key={groupLabel} className="space-y-2">
                <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
                  Tournée · {groupLabel}
                  <span className="a-mono ml-2 font-normal normal-case tracking-normal text-a-fg-muted">
                    {rows.length}
                  </span>
                </p>
                <div className="overflow-x-auto rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-2">
                  <table className="w-full min-w-[52rem] border-collapse text-left text-[length:var(--a-text-sm)]">
                    <thead className="border-b border-a-border-subtle bg-a-surface-3/80 text-a-fg-muted">
                      <tr>
                        <th className="a-table-cell font-medium">N°</th>
                        <th className="a-table-cell font-medium">Commande</th>
                        <th className="a-table-cell font-medium">Client</th>
                        <th className="a-table-cell font-medium">Livreur</th>
                        <th className="a-table-cell font-medium">Statut</th>
                        <th className="a-table-cell font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-a-border-subtle last:border-0 hover:bg-a-surface-3/60"
                        >
                          <td className="a-mono a-table-cell">{row.number}</td>
                          <td className="a-mono a-table-cell">
                            {row.orderNumber ?? "—"}
                          </td>
                          <td className="a-table-cell">
                            {row.customerName ?? row.customerCode ?? "—"}
                          </td>
                          <td className="a-table-cell">
                            {row.status === "READY" ||
                            row.status === "ASSIGNED" ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <AInput
                                  value={
                                    assignDraft[row.id] ??
                                    row.driverLabel ??
                                    ""
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
                          <td className="a-table-cell">
                            <div className="space-y-1">
                              <ABadge tone={shipmentBadgeTone(row.status)}>
                                {SHIPMENT_STATUS_LABELS[row.status]}
                              </ABadge>
                              {row.status === "FAILED" && row.failReason ? (
                                <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                                  {row.failReason}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="a-table-cell">
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
                                    onClick={() =>
                                      setFailDraft({
                                        id: row.id,
                                        number: row.number,
                                        reason: "",
                                      })
                                    }
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
              </div>
            ))
          : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
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

      <ADrawer
        open={failDraft != null}
        onOpenChange={(open) => {
          if (!open) setFailDraft(null);
        }}
        title="Marquer échec"
        description={
          failDraft
            ? `Livraison ${failDraft.number} — motif (optionnel).`
            : undefined
        }
      >
        {failDraft ? (
          <div className="space-y-[var(--a-space-4)]">
            <div className="space-y-1">
              <label
                htmlFor="dlv-fail-reason"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Motif
              </label>
              <AInput
                id="dlv-fail-reason"
                value={failDraft.reason}
                onChange={(e) =>
                  setFailDraft({ ...failDraft, reason: e.target.value })
                }
                placeholder="Client absent, adresse incorrecte…"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFailDraft(null)}
                disabled={busy}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                variant="danger"
                size="sm"
                onClick={() => void submitFail()}
                disabled={busy}
              >
                Confirmer l’échec
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

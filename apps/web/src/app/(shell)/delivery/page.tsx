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
  assignShipmentDriver,
  completeShipment,
  createRound,
  createShipment,
  dispatchShipment,
  failShipment,
  fetchEligibleOrders,
  fetchRounds,
  fetchShipments,
  type DeliveryRound,
  type DeliveryShipment,
  type EligibleOrder,
  type ShipmentStatus,
} from "@/lib/delivery";
import {
  softChipClass,
  softPageBody,
} from "@/lib/soft-glass-ui";
import { useStatusLabel } from "@/hooks/use-status-label";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: DeliveryShipment[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type FormState = {
  orderId: string | null;
  orderLabel: string;
  driverLabel: string;
  roundId: string | null;
  roundLabel: string;
};

type RoundForm = {
  date: string;
  driverLabel: string;
  notes: string;
};

type FailDraft = { id: string; number: string; reason: string };

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

function roundToOption(r: DeliveryRound): AComboboxOption {
  return {
    id: r.id,
    label: `${r.date} · ${r.driverLabel}`,
    hint: `${r.status} · ${r.shipmentCount} liv.`,
  };
}

function tourneeKey(row: DeliveryShipment): string {
  if (row.roundId) {
    return `${row.roundDate ?? "—"} · ${row.roundDriverLabel ?? row.driverLabel ?? "Sans livreur"}`;
  }
  const day = row.createdAt.slice(0, 10);
  const driver = row.driverLabel?.trim() || "Sans livreur";
  return `${day} · ${driver} (soft)`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DeliveryPage() {
  const { label: st } = useStatusLabel();
  const STATUS_FILTERS: Array<{ id: "" | ShipmentStatus; label: string }> = [
    { id: "", label: st("ALL", "Tous") },
    { id: "READY", label: st("READY") },
    { id: "ASSIGNED", label: st("ASSIGNED") },
    { id: "OUT", label: st("OUT") },
    { id: "DELIVERED", label: st("DELIVERED") },
    { id: "FAILED", label: st("FAILED") },
  ];
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | ShipmentStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [roundDrawerOpen, setRoundDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [roundForm, setRoundForm] = useState<RoundForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [orderOpts, setOrderOpts] = useState<AComboboxOption[]>([]);
  const [roundOpts, setRoundOpts] = useState<AComboboxOption[]>([]);
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

  async function refreshRounds() {
    const res = await fetchRounds();
    if (!res.ok) {
      setRoundOpts([]);
      return;
    }
    setRoundOpts(res.items.map(roundToOption));
  }

  function openCreate() {
    setFormError(null);
    setForm({
      orderId: null,
      orderLabel: "",
      driverLabel: "",
      roundId: null,
      roundLabel: "",
    });
    setOrderOpts([]);
    void refreshRounds();
    setDrawerOpen(true);
  }

  function openRoundCreate() {
    setRoundError(null);
    setRoundForm({ date: todayIso(), driverLabel: "", notes: "" });
    setRoundDrawerOpen(true);
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
      roundId: form.roundId ?? undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFormError(res.message);
      return;
    }
    setDrawerOpen(false);
    await load(q, statusFilter);
  }

  async function submitRound() {
    if (!roundForm?.driverLabel.trim()) {
      setRoundError("Indiquez le livreur de la tournée.");
      return;
    }
    setBusy(true);
    setRoundError(null);
    const res = await createRound({
      date: roundForm.date || todayIso(),
      driverLabel: roundForm.driverLabel.trim(),
      notes: roundForm.notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setRoundError(res.message);
      return;
    }
    setRoundDrawerOpen(false);
    await refreshRounds();
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
        description="Rounds CRUD · livraisons · stock issue/release · AR auto à la livraison."
        actions={
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={openRoundCreate}
            >
              Nouvelle tournée
            </AButton>
            <AButton type="button" size="sm" onClick={openCreate}>
              Nouvelle livraison
            </AButton>
          </div>
        }
      />
      <div className={softPageBody}>
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filtrer par statut"
        >
          {STATUS_FILTERS.map((chip) => {
            const active = statusFilter === chip.id;
            return (
              <button
                key={chip.id || "all"}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(chip.id)}
                className={softChipClass(active)}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label htmlFor="dlv-q" className="text-[12px] text-a-fg-subtle">
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
            description="Créez une tournée, puis une expédition liée à une commande confirmée."
            actionLabel="Nouvelle livraison"
            onAction={openCreate}
          />
        ) : null}

        {state.kind === "ok" && state.items.length > 0
          ? tourneeGroups.map(([groupLabel, rows]) => (
              <div key={groupLabel} className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-a-fg-subtle">
                  Tournée · {groupLabel}
                  <span className="a-mono ml-2 font-normal normal-case tracking-normal text-a-fg-muted">
                    {rows.length}
                  </span>
                </p>
                <ul className="space-y-1">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className="space-y-2 rounded-[12px] px-3 py-3 hover:bg-a-surface-3/70"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="a-mono text-[13px] font-semibold text-a-fg">
                              {row.number}
                            </span>
                            <ABadge tone={shipmentBadgeTone(row.status)}>
                              {st(row.status)}
                            </ABadge>
                          </div>
                          <p className="mt-0.5 truncate text-[12px] text-a-fg-muted">
                            {row.orderNumber ?? "—"}
                            {" · "}
                            {row.customerName ?? row.customerCode ?? "—"}
                          </p>
                          {row.status === "FAILED" && row.failReason ? (
                            <p className="mt-1 text-[12px] text-a-fg-muted">
                              {row.failReason}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
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
                      </div>
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
                        <p className="text-[12px] text-a-fg-muted">
                          Livreur · {row.driverLabel ?? "—"}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          : null}
      </div>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle livraison"
        description="Commande confirmée · tournée optionnelle."
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

            <ACombobox
              label="Tournée (optionnel)"
              valueId={form.roundId}
              displayValue={form.roundLabel}
              onDisplayChange={(text) => {
                setForm({ ...form, roundLabel: text, roundId: null });
              }}
              onSelect={(opt) => {
                const driverFromRound =
                  String(opt.label).split(" · ")[1]?.trim() || "";
                setForm({
                  ...form,
                  roundId: opt.id,
                  roundLabel: opt.label,
                  driverLabel: form.driverLabel.trim() || driverFromRound,
                });
              }}
              onOpen={() => void refreshRounds()}
              options={roundOpts}
              placeholder="Choisir une tournée…"
              emptyText="Aucune tournée — créez-en une"
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
        open={roundDrawerOpen}
        onOpenChange={setRoundDrawerOpen}
        title="Nouvelle tournée"
        description="Planifier une tournée (date + livreur)."
      >
        {roundForm ? (
          <div className="space-y-[var(--a-space-4)]">
            {roundError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {roundError}
              </p>
            ) : null}
            <div className="space-y-1">
              <label
                htmlFor="dlv-round-date"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Date
              </label>
              <AInput
                id="dlv-round-date"
                type="date"
                value={roundForm.date}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, date: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="dlv-round-driver"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Livreur
              </label>
              <AInput
                id="dlv-round-driver"
                value={roundForm.driverLabel}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, driverLabel: e.target.value })
                }
                placeholder="Nom du livreur"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="dlv-round-notes"
                className="text-[length:var(--a-text-sm)] text-a-fg-muted"
              >
                Notes
              </label>
              <AInput
                id="dlv-round-notes"
                value={roundForm.notes}
                onChange={(e) =>
                  setRoundForm({ ...roundForm, notes: e.target.value })
                }
                placeholder="Optionnel"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRoundDrawerOpen(false)}
                disabled={busy}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                onClick={() => void submitRound()}
                disabled={busy}
              >
                Créer la tournée
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

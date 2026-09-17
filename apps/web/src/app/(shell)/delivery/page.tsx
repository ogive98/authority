"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ABadge,
  AButton,
  ACombobox,
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
  ATabs,
  erpListDescription,
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
  fetchShipment,
  fetchShipments,
  type DeliveryOrderLine,
  type DeliveryRound,
  type DeliveryShipment,
  type EligibleOrder,
  type ShipmentStatus,
} from "@/lib/delivery";
import { fetchAssignments } from "@/lib/fleet";
import { useStatusLabel } from "@/hooks/use-status-label";
import { shouldHideDeliveryRoute } from "@/lib/ops-visibility";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";

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

type CompleteDraft = {
  id: string;
  number: string;
  lines: Array<{
    orderLineId: string;
    label: string;
    ordered: number;
    qty: string;
  }>;
  error: string | null;
};

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
  const reste =
    o.remainingLineCount != null
      ? `${o.remainingLineCount} ligne(s) restante(s)`
      : `${o.lineCount} ligne(s)`;
  return {
    id: o.id,
    label: `${o.number} — ${o.customerName ?? o.customerCode ?? "Client"}${
      o.followUp ? " · suite" : ""
    }`,
    hint: o.preferredDriver
      ? `Livreur hint: ${o.preferredDriver}`
      : reste,
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
  const [completeDraft, setCompleteDraft] = useState<CompleteDraft | null>(
    null,
  );
  const [fleetByRound, setFleetByRound] = useState<
    Map<string, { code: string; plate: string; cold: boolean }>
  >(() => new Map());
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadFleetStrip = useCallback(async () => {
    const res = await fetchAssignments();
    if (!res.ok) {
      // Module off / no perm — silent
      setFleetByRound(new Map());
      return;
    }
    const map = new Map<
      string,
      { code: string; plate: string; cold: boolean }
    >();
    for (const a of res.data.items) {
      if (a.cancelledAt || !a.vehicle) continue;
      map.set(a.roundId, {
        code: a.vehicle.code,
        plate: a.vehicle.plate,
        cold: a.vehicle.cold,
      });
    }
    setFleetByRound(map);
  }, []);

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
    void loadFleetStrip();
  }, [loadFleetStrip]);

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
    const detail = await fetchShipment(row.id);
    if (!detail.ok) {
      setState({ kind: "error", message: detail.message });
      return;
    }
    const lines = (detail.data.orderLines ?? []).filter((l) => {
      const rem = Number(l.remainingQty ?? l.qty);
      return Number.isFinite(rem) && rem > 0;
    });
    if (lines.length === 0) {
      setState({
        kind: "error",
        message: "Aucune quantité restante à livrer sur cette livraison.",
      });
      return;
    }
    setCompleteDraft({
      id: row.id,
      number: row.number,
      lines: lines.map((l: DeliveryOrderLine) => {
        const remaining = Number(l.remainingQty ?? l.qty);
        return {
          orderLineId: l.id,
          label: `${l.productSku ?? "SKU"} · ${l.productName ?? "Produit"}`,
          ordered: remaining,
          qty: String(remaining),
        };
      }),
      error: null,
    });
  }

  async function submitComplete() {
    if (!completeDraft) return;
    const lines = completeDraft.lines.map((l) => ({
      orderLineId: l.orderLineId,
      qty: Number(l.qty),
    }));
    for (const l of lines) {
      const ordered =
        completeDraft.lines.find((x) => x.orderLineId === l.orderLineId)
          ?.ordered ?? 0;
      if (!Number.isFinite(l.qty) || l.qty < 0 || l.qty > ordered + 1e-9) {
        setCompleteDraft({
          ...completeDraft,
          error: "Qty livrée doit être entre 0 et la qty commandée.",
        });
        return;
      }
    }
    if (!lines.some((l) => l.qty > 0)) {
      setCompleteDraft({
        ...completeDraft,
        error: "Au moins une ligne doit avoir une qty livrée > 0.",
      });
      return;
    }
    setBusy(true);
    const res = await completeShipment(completeDraft.id, lines);
    setBusy(false);
    if (!res.ok) {
      setCompleteDraft({ ...completeDraft, error: res.message });
      return;
    }
    setCompleteDraft(null);
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

  const ghostEnabled = useShellStore((s) => s.ghostEnabled);
  const patchEnabled = useShellStore((s) => s.patchEnabled);
  const opsVisibility = usePrefsStore((s) => s.opsVisibility);
  const hideBl = shouldHideDeliveryRoute({
    ghostEnabled,
    patchEnabled,
    prefs: opsVisibility,
  });

  if (hideBl) {
    return (
      <>
        <AScreenHeader
          kicker="Logistique"
          title="Livraison masquée"
          description="Mode GHOST / PATCH — bons de livraison masqués (préférence société)."
        />
        <APageBody>
          <AForbiddenState message="BL masqué en mode ops. Sortir via le code calculatrice, ou ajuster les prefs Admin (ops.*.hide_delivery)." />
        </APageBody>
      </>
    );
  }

  return (
    <>
      <AScreenHeader
        kicker="Logistique"
        title="Tournées"
        description={erpListDescription(
          state.kind === "ok" ? state.items.length : null,
          "Rounds · stock issue/release · AR auto à la livraison",
        )}
        primary={
          <AButton type="button" size="sm" onClick={openCreate}>
            Nouvelle livraison
          </AButton>
        }
        more={
          <AOverflowMenu
            items={[
              {
                id: "new-round",
                label: "Nouvelle tournée",
                onSelect: openRoundCreate,
              },
            ]}
          />
        }
      />
      <APageBody>
        <AFilterBar
          search={
            <AInput
              id="dlv-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="N° livraison / livreur"
              aria-label="Recherche"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load(q, statusFilter);
              }}
            />
          }
          filters={
            <ATabs
              ariaLabel="Filtrer par statut"
              value={statusFilter || "all"}
              onValueChange={(id) => {
                const next = (id === "all" ? "" : id) as "" | ShipmentStatus;
                setStatusFilter(next);
              }}
              items={STATUS_FILTERS.map((chip) => ({
                id: chip.id || "all",
                label: chip.label,
              }))}
            />
          }
          utilities={
            <AListUtilities onFilter={() => void load(q, statusFilter)} />
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
          ? tourneeGroups.map(([groupLabel, rows]) => {
              const roundId = rows.find((r) => r.roundId)?.roundId ?? null;
              const fleet = roundId ? fleetByRound.get(roundId) : undefined;
              return (
                <div key={groupLabel} className="space-y-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-a-fg-subtle">
                    Tournée · {groupLabel}
                    <span className="a-mono ml-2 font-normal normal-case tracking-normal text-a-fg-muted">
                      {rows.length}
                    </span>
                    {fleet ? (
                      <ABadge
                        tone="info"
                        className="ml-2 normal-case tracking-normal"
                      >
                        Véhicule · {fleet.code} · {fleet.plate}
                        {fleet.cold ? " · froid" : ""}
                      </ABadge>
                    ) : null}
                  </p>
                  <ASoftTable className="min-w-[48rem]">
                    <ASoftThead>
                      <ASoftTr>
                        <ASoftTh>Livraison</ASoftTh>
                        <ASoftTh>Commande / client</ASoftTh>
                        <ASoftTh>Statut</ASoftTh>
                        <ASoftTh>Livreur</ASoftTh>
                        <ASoftTh>Actions</ASoftTh>
                      </ASoftTr>
                    </ASoftThead>
                    <tbody>
                      {rows.map((row) => (
                        <ASoftTr key={row.id}>
                          <ASoftTd>
                            <span className="a-mono font-semibold">
                              {row.number}
                            </span>
                            {row.status === "FAILED" && row.failReason ? (
                              <p className="mt-1 text-[12px] text-a-fg-muted">
                                {row.failReason}
                              </p>
                            ) : null}
                          </ASoftTd>
                          <ASoftTd>
                            {row.orderNumber ?? "—"}
                            {" · "}
                            {row.customerName ?? row.customerCode ?? "—"}
                          </ASoftTd>
                          <ASoftTd>
                            <ABadge tone={shipmentBadgeTone(row.status)}>
                              {st(row.status)}
                            </ABadge>
                          </ASoftTd>
                          <ASoftTd>
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
                          </ASoftTd>
                          <ASoftTd>
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
                          </ASoftTd>
                        </ASoftTr>
                      ))}
                    </tbody>
                  </ASoftTable>
                </div>
              );
            })
          : null}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouvelle livraison"
        description="Commande confirmée · tournée optionnelle."
      >
        {form ? (
          <div className="space-y-5">
            {formError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {formError}
              </p>
            ) : null}

            <AFormSection title="Commande & tournée">
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

              <AField label="Livreur" htmlFor="dlv-driver">
                <AInput
                  id="dlv-driver"
                  value={form.driverLabel}
                  onChange={(e) =>
                    setForm({ ...form, driverLabel: e.target.value })
                  }
                  placeholder="Nom du livreur"
                />
              </AField>
            </AFormSection>

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
          <div className="space-y-5">
            {roundError ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {roundError}
              </p>
            ) : null}
            <AFormSection title="Planification">
              <AField label="Date" htmlFor="dlv-round-date" required>
                <AInput
                  id="dlv-round-date"
                  type="date"
                  value={roundForm.date}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, date: e.target.value })
                  }
                />
              </AField>
              <AField label="Livreur" htmlFor="dlv-round-driver" required>
                <AInput
                  id="dlv-round-driver"
                  value={roundForm.driverLabel}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, driverLabel: e.target.value })
                  }
                  placeholder="Nom du livreur"
                />
              </AField>
              <AField label="Notes" htmlFor="dlv-round-notes">
                <AInput
                  id="dlv-round-notes"
                  value={roundForm.notes}
                  onChange={(e) =>
                    setRoundForm({ ...roundForm, notes: e.target.value })
                  }
                  placeholder="Optionnel"
                />
              </AField>
            </AFormSection>
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
        open={completeDraft != null}
        onOpenChange={(open) => {
          if (!open) setCompleteDraft(null);
        }}
        title="Confirmer livraison"
        description={
          completeDraft
            ? `${completeDraft.number} — ajuster les quantités livrées (TND / stock).`
            : undefined
        }
      >
        {completeDraft ? (
          <div className="space-y-[var(--a-space-4)]">
            {completeDraft.error ? (
              <p className="text-[length:var(--a-text-sm)] text-a-warning">
                {completeDraft.error}
              </p>
            ) : null}
            <ul className="space-y-3">
              {completeDraft.lines.map((line) => (
                <li key={line.orderLineId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] text-a-fg">{line.label}</p>
                    <span className="a-mono shrink-0 text-[12px] text-a-fg-muted">
                      reste {line.ordered}
                    </span>
                  </div>
                  <AInput
                    type="number"
                    min={0}
                    max={line.ordered}
                    step="0.001"
                    value={line.qty}
                    onChange={(e) =>
                      setCompleteDraft({
                        ...completeDraft,
                        error: null,
                        lines: completeDraft.lines.map((x) =>
                          x.orderLineId === line.orderLineId
                            ? { ...x, qty: e.target.value }
                            : x,
                        ),
                      })
                    }
                    aria-label={`Qty livrée ${line.label}`}
                  />
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setCompleteDraft(null)}
                disabled={busy}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  setCompleteDraft({
                    ...completeDraft,
                    error: null,
                    lines: completeDraft.lines.map((l) => ({
                      ...l,
                      qty: String(l.ordered),
                    })),
                  })
                }
              >
                Tout livrer
              </AButton>
              <AButton
                type="button"
                size="sm"
                onClick={() => void submitComplete()}
                disabled={busy}
              >
                Confirmer livré
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

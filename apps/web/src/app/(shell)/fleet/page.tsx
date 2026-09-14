"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AFilterBar,
  AForbiddenState,
  AInput,
  APageBody,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASwitch,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softChipClass, softSelect } from "@/lib/soft-glass-ui";
import { fetchRounds, type DeliveryRound } from "@/lib/delivery";
import {
  FLEET_VEHICLE_STATUS_LABELS,
  cancelAssignment,
  copyAssignmentDriver,
  createAssignment,
  createVehicle,
  fetchAssignHints,
  fetchAssignments,
  fetchVehicles,
  type FleetAssignment,
  type FleetVehicle,
  type FleetVehicleStatus,
} from "@/lib/fleet";

type Tab = "vehicles" | "planning";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: FleetVehicle[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type VehicleForm = {
  code: string;
  plate: string;
  capacityKg: string;
  cold: boolean;
  odometerKm: string;
  notes: string;
};

type AssignForm = {
  roundId: string;
  vehicleId: string;
  driverLabel: string;
  payloadKg: string;
  notes: string;
};

function parseTab(raw: string | null): Tab {
  return raw === "planning" ? "planning" : "vehicles";
}

function statusTone(
  s: FleetVehicleStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (s === "ACTIVE") return "success";
  if (s === "MAINTENANCE") return "warning";
  if (s === "OUT") return "danger";
  return "neutral";
}

const STATUS_CHIPS: Array<{ id: "" | FleetVehicleStatus; label: string }> = [
  { id: "", label: "Tous" },
  { id: "ACTIVE", label: "Actif" },
  { id: "MAINTENANCE", label: "En atelier" },
  { id: "OUT", label: "Hors service" },
  { id: "ARCHIVED", label: "Archivé" },
];

export default function FleetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | FleetVehicleStatus>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [rounds, setRounds] = useState<DeliveryRound[]>([]);
  const [assignments, setAssignments] = useState<FleetAssignment[]>([]);
  const [planState, setPlanState] = useState<
    "loading" | "ok" | "forbidden" | "error"
  >("loading");
  const [planError, setPlanError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignForm | null>(null);
  const [assignHint, setAssignHint] = useState<{
    requiresCold: boolean;
    perishableProductCount: number;
  } | null>(null);

  const setTab = useCallback(
    (next: Tab) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "vehicles") sp.delete("tab");
      else sp.set("tab", next);
      const qs = sp.toString();
      router.replace(qs ? `/fleet?${qs}` : "/fleet");
    },
    [router, searchParams],
  );

  const emptyForm = useCallback(
    (): VehicleForm => ({
      code: "",
      plate: "",
      capacityKg: "",
      cold: true,
      odometerKm: "",
      notes: "",
    }),
    [],
  );

  const loadVehicles = useCallback(
    async (query?: string, status?: "" | FleetVehicleStatus) => {
      setState({ kind: "loading" });
      const res = await fetchVehicles({
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
    },
    [],
  );

  const loadPlanning = useCallback(async () => {
    setPlanState("loading");
    setPlanError(null);
    const [rRes, aRes, vRes] = await Promise.all([
      fetchRounds(),
      fetchAssignments(),
      fetchVehicles({ status: "ACTIVE" }),
    ]);
    if (!rRes.ok || !aRes.ok || !vRes.ok) {
      const fail = !rRes.ok ? rRes : !aRes.ok ? aRes : vRes;
      if (fail.status === 403) {
        setPlanState("forbidden");
        setPlanError(fail.message);
        return;
      }
      setPlanState("error");
      setPlanError(fail.message);
      return;
    }
    setRounds(rRes.items);
    setAssignments(aRes.data.items);
    setState({ kind: "ok", items: vRes.data.items });
    setPlanState("ok");
  }, []);

  useEffect(() => {
    if (tab === "vehicles") void loadVehicles(q, statusFilter);
    else void loadPlanning();
  }, [tab, loadVehicles, loadPlanning, statusFilter]);

  const assignmentByRound = useMemo(() => {
    const map = new Map<string, FleetAssignment>();
    for (const a of assignments) {
      if (!a.cancelledAt) map.set(a.roundId, a);
    }
    return map;
  }, [assignments]);

  const activeVehicles = useMemo(() => {
    if (state.kind !== "ok") return [];
    return state.items.filter((v) => v.status === "ACTIVE");
  }, [state]);

  const assignVehicleOptions = useMemo(() => {
    if (!assignHint?.requiresCold) return activeVehicles;
    const coldOnly = activeVehicles.filter((v) => v.cold);
    return coldOnly.length > 0 ? coldOnly : activeVehicles;
  }, [activeVehicles, assignHint]);

  function openCreate() {
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSaveVehicle() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      const cap = form.capacityKg.trim();
      const odo = form.odometerKm.trim();
      const res = await createVehicle({
        code: form.code.trim(),
        plate: form.plate.trim(),
        capacityKg: cap ? Number(cap) : undefined,
        cold: form.cold,
        odometerKm: odo ? Number(odo) : undefined,
        notes: form.notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setDrawerOpen(false);
      await loadVehicles(q, statusFilter);
    } finally {
      setBusy(false);
    }
  }

  async function openAssign(round: DeliveryRound) {
    const existing = assignmentByRound.get(round.id);
    setFormError(null);
    setAssignHint(null);
    const hints = await fetchAssignHints(round.id);
    const hint = hints.ok
      ? {
          requiresCold: hints.data.requiresCold,
          perishableProductCount: hints.data.perishableProductCount,
        }
      : null;
    setAssignHint(hint);

    const pool = hint?.requiresCold
      ? activeVehicles.filter((v) => v.cold)
      : activeVehicles;
    const options = pool.length > 0 ? pool : activeVehicles;

    setAssignForm({
      roundId: round.id,
      vehicleId: existing?.vehicleId ?? options[0]?.id ?? "",
      driverLabel: existing?.driverLabel ?? round.driverLabel ?? "",
      payloadKg: existing?.payloadKg ?? "",
      notes: existing?.notes ?? "",
    });
    setAssignOpen(true);
  }

  async function onAssign() {
    if (!assignForm) return;
    setBusy(true);
    setFormError(null);
    try {
      const payload = assignForm.payloadKg.trim();
      const res = await createAssignment({
        roundId: assignForm.roundId,
        vehicleId: assignForm.vehicleId,
        driverLabel: assignForm.driverLabel.trim(),
        payloadKg: payload ? Number(payload) : undefined,
        notes: assignForm.notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(
          res.code ? `${res.code} — ${res.message}` : res.message,
        );
        return;
      }
      setAssignOpen(false);
      await loadPlanning();
    } finally {
      setBusy(false);
    }
  }

  async function onCancelAssignment(id: string) {
    setBusy(true);
    try {
      const res = await cancelAssignment(id);
      if (!res.ok) {
        setPlanError(res.message);
        return;
      }
      await loadPlanning();
    } finally {
      setBusy(false);
    }
  }

  async function onCopyDriver(assignmentId: string) {
    setBusy(true);
    setPlanError(null);
    try {
      const res = await copyAssignmentDriver(assignmentId);
      if (!res.ok) {
        setPlanError(
          res.code ? `${res.code} — ${res.message}` : res.message,
        );
        return;
      }
      await loadPlanning();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Flotte"
        title="Véhicules & planning"
        description="Fiche · historique · froid / capacité · pas de GPS (D254)."
        primary={
          tab === "vehicles" ? (
            <AButton type="button" size="sm" onClick={openCreate}>
              {LAYOUT_ACTIONS.newVehicle}
            </AButton>
          ) : undefined
        }
      />
      <APageBody>
        <div className="mb-4 flex gap-2">
          <AButton
            type="button"
            size="sm"
            variant={tab === "vehicles" ? "primary" : "secondary"}
            onClick={() => setTab("vehicles")}
          >
            Véhicules
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant={tab === "planning" ? "primary" : "secondary"}
            onClick={() => setTab("planning")}
          >
            Planning
          </AButton>
        </div>

        {tab === "vehicles" && (
          <>
            <AFilterBar
              search={
                <AInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Code ou plaque…"
                  aria-label="Recherche véhicules"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadVehicles(q, statusFilter);
                  }}
                />
              }
              filters={
                <div
                  className="flex flex-wrap gap-2"
                  role="tablist"
                  aria-label="Filtrer par statut"
                >
                  {STATUS_CHIPS.map((chip) => {
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
              }
              utilities={
                <AButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void loadVehicles(q, statusFilter)}
                >
                  Filtrer
                </AButton>
              }
            />

            {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
            {state.kind === "forbidden" && (
              <AForbiddenState message={state.message} />
            )}
            {state.kind === "error" && <AErrorState message={state.message} />}
            {state.kind === "ok" && state.items.length === 0 && (
              <AEmptyState
                title={
                  statusFilter
                    ? `Aucun véhicule · ${
                        STATUS_CHIPS.find((c) => c.id === statusFilter)
                          ?.label ?? statusFilter
                      }`
                    : "Aucun véhicule"
                }
                description={
                  statusFilter
                    ? "Aucun véhicule avec ce statut. Repassez sur « Tous » ou changez le statut d’un véhicule sur sa fiche."
                    : "Créez un véhicule (plaque, froid, capacité)."
                }
                actionLabel={
                  statusFilter ? "Voir tous" : LAYOUT_ACTIONS.newVehicle
                }
                onAction={
                  statusFilter
                    ? () => setStatusFilter("")
                    : openCreate
                }
              />
            )}
            {state.kind === "ok" && state.items.length > 0 && (
              <ASoftTable>
                <ASoftThead>
                  <tr>
                    <th>Code</th>
                    <th>Plaque</th>
                    <th>Froid</th>
                    <th>Capacité kg</th>
                    <th>Km</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </ASoftThead>
                <tbody>
                  {state.items.map((v) => (
                    <ASoftTr key={v.id}>
                      <td className="font-medium">
                        <Link
                          href={`/fleet/${v.id}`}
                          className="text-a-accent underline-offset-2 hover:underline"
                        >
                          {v.code}
                        </Link>
                      </td>
                      <td className="tabular-nums">{v.plate}</td>
                      <td>{v.cold ? "Oui" : "Non"}</td>
                      <td className="tabular-nums">
                        {v.capacityKg ?? "—"}
                      </td>
                      <td className="tabular-nums">
                        {v.odometerKm ?? "—"}
                      </td>
                      <td>
                        <ABadge tone={statusTone(v.status)}>
                          {FLEET_VEHICLE_STATUS_LABELS[v.status]}
                        </ABadge>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/fleet/${v.id}`}
                          className="text-[length:var(--a-text-sm)] text-a-fg-muted underline-offset-2 hover:underline"
                        >
                          Fiche
                        </Link>
                      </td>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </>
        )}

        {tab === "planning" && (
          <>
            {planState === "loading" && <ASkeleton className="h-40 w-full" />}
            {planState === "forbidden" && (
              <AForbiddenState message={planError ?? ""} />
            )}
            {planState === "error" && (
              <AErrorState message={planError ?? ""} />
            )}
            {planState === "ok" && planError && (
              <p className="mb-3 text-[length:var(--a-text-sm)] text-a-danger">
                {planError}
              </p>
            )}
            {planState === "ok" && rounds.length === 0 && (
              <AEmptyState
                title="Aucune tournée"
                description="Créez une tournée dans Livraison, puis affectez un véhicule ici."
              />
            )}
            {planState === "ok" && rounds.length > 0 && (
              <ASoftTable>
                <ASoftThead>
                  <tr>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Chauffeur tournée</th>
                    <th>Véhicule flotte</th>
                    <th>Chauffeur affecté</th>
                    <th />
                  </tr>
                </ASoftThead>
                <tbody>
                  {rounds.map((r) => {
                    const a = assignmentByRound.get(r.id);
                    return (
                      <ASoftTr key={r.id}>
                        <td className="tabular-nums">{r.date}</td>
                        <td>
                          <ABadge tone="neutral">{r.status}</ABadge>
                        </td>
                        <td>{r.driverLabel}</td>
                        <td>
                          {a?.vehicle
                            ? `${a.vehicle.code} · ${a.vehicle.plate}${
                                a.vehicle.cold ? " · froid" : ""
                              }`
                            : "—"}
                        </td>
                        <td>{a?.driverLabel ?? "—"}</td>
                        <td className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            {r.status !== "DONE" && (
                              <AButton
                                type="button"
                                size="sm"
                                onClick={() => void openAssign(r)}
                                disabled={busy}
                              >
                                {LAYOUT_ACTIONS.assign}
                              </AButton>
                            )}
                            {a && r.status !== "DONE" && (
                              <AButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                className={
                                  a.driverLabel.trim() !== r.driverLabel.trim()
                                    ? "ring-1 ring-a-accent/40"
                                    : undefined
                                }
                                onClick={() => void onCopyDriver(a.id)}
                              >
                                Copier chauffeur → tournée
                              </AButton>
                            )}
                            {a && r.status !== "DONE" && (
                              <AButton
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busy}
                                onClick={() => void onCancelAssignment(a.id)}
                              >
                                {LAYOUT_ACTIONS.cancel}
                              </AButton>
                            )}
                          </div>
                        </td>
                      </ASoftTr>
                    );
                  })}
                </tbody>
              </ASoftTable>
            )}
          </>
        )}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Nouveau véhicule"
      >
        {form && (
          <div className="space-y-3">
            {formError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            )}
            <Field label="Code">
              <AInput
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </Field>
            <Field label="Plaque">
              <AInput
                value={form.plate}
                onChange={(e) => setForm({ ...form, plate: e.target.value })}
              />
            </Field>
            <Field label="Capacité (kg)">
              <AInput
                value={form.capacityKg}
                onChange={(e) =>
                  setForm({ ...form, capacityKg: e.target.value })
                }
              />
            </Field>
            <Field label="Odomètre (km)">
              <AInput
                value={form.odometerKm}
                onChange={(e) =>
                  setForm({ ...form, odometerKm: e.target.value })
                }
              />
            </Field>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                Froid
              </span>
              <ASwitch
                label="Froid"
                checked={form.cold}
                onCheckedChange={(checked) =>
                  setForm({ ...form, cold: checked })
                }
              />
            </div>
            <Field label="Notes">
              <AInput
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                onClick={() => setDrawerOpen(false)}
              >
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onSaveVehicle()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        )}
      </ADrawer>

      <ADrawer
        open={assignOpen}
        onOpenChange={setAssignOpen}
        title="Affecter un véhicule"
      >
        {assignForm && (
          <div className="space-y-3">
            {assignHint?.requiresCold && (
              <p className="a-underlay rounded-md p-3 text-[length:var(--a-text-sm)] text-a-fg">
                Tournée avec produits périssables — véhicule froid requis
                {assignHint.perishableProductCount > 0
                  ? ` (${assignHint.perishableProductCount})`
                  : ""}
                .
              </p>
            )}
            {formError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            )}
            <Field label="Véhicule">
              <select
                className={softSelect}
                value={assignForm.vehicleId}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    vehicleId: e.target.value,
                  })
                }
              >
                {assignVehicleOptions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} · {v.plate}
                    {v.cold ? " · froid" : ""}
                    {v.capacityKg ? ` · ${v.capacityKg} kg` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Chauffeur (texte libre)">
              <AInput
                value={assignForm.driverLabel}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    driverLabel: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Charge (kg) — optionnel">
              <AInput
                value={assignForm.payloadKg}
                onChange={(e) =>
                  setAssignForm({
                    ...assignForm,
                    payloadKg: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Notes">
              <AInput
                value={assignForm.notes}
                onChange={(e) =>
                  setAssignForm({ ...assignForm, notes: e.target.value })
                }
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                onClick={() => setAssignOpen(false)}
              >
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton
                type="button"
                disabled={busy || !assignForm.vehicleId}
                onClick={() => void onAssign()}
              >
                {LAYOUT_ACTIONS.assign}
              </AButton>
            </div>
          </div>
        )}
      </ADrawer>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

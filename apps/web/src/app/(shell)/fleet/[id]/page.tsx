"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ABadge,
  AButton,
  ADrawer,
  AEmptyState,
  AErrorState,
  AForbiddenState,
  AInput,
  APageBody,
  APageSection,
  AScreenHeader,
  ASkeleton,
  ASoftTable,
  ASoftThead,
  ASoftTr,
  ASwitch,
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softSelect } from "@/lib/soft-glass-ui";
import {
  FLEET_VEHICLE_STATUS_LABELS,
  fetchAssignments,
  fetchVehicle,
  updateVehicle,
  type FleetAssignment,
  type FleetVehicle,
  type FleetVehicleStatus,
} from "@/lib/fleet";

type Load =
  | { kind: "loading" }
  | { kind: "ok"; data: FleetVehicle; history: FleetAssignment[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type EditForm = {
  plate: string;
  capacityKg: string;
  cold: boolean;
  odometerKm: string;
  notes: string;
  status: FleetVehicleStatus;
  version: number;
};

const STATUSES = Object.keys(
  FLEET_VEHICLE_STATUS_LABELS,
) as FleetVehicleStatus[];

function statusTone(
  s: FleetVehicleStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (s === "ACTIVE") return "success";
  if (s === "MAINTENANCE") return "warning";
  if (s === "OUT") return "danger";
  return "neutral";
}

export default function FleetVehiclePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ kind: "loading" });
    const [vRes, aRes] = await Promise.all([
      fetchVehicle(id),
      fetchAssignments({ vehicleId: id, includeCancelled: true }),
    ]);
    if (!vRes.ok) {
      if (vRes.status === 403) {
        setState({ kind: "forbidden", message: vRes.message });
        return;
      }
      setState({ kind: "error", message: vRes.message });
      return;
    }
    const history = aRes.ok ? aRes.data.items : [];
    setState({ kind: "ok", data: vRes.data, history });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit() {
    if (state.kind !== "ok") return;
    const v = state.data;
    setForm({
      plate: v.plate,
      capacityKg: v.capacityKg ?? "",
      cold: v.cold,
      odometerKm: v.odometerKm ?? "",
      notes: v.notes ?? "",
      status: v.status,
      version: v.version,
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  async function onSave() {
    if (!form || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const cap = form.capacityKg.trim();
      const odo = form.odometerKm.trim();
      const res = await updateVehicle(state.data.id, {
        version: form.version,
        plate: form.plate.trim(),
        capacityKg: cap ? Number(cap) : null,
        cold: form.cold,
        odometerKm: odo ? Number(odo) : null,
        notes: form.notes.trim() || null,
        status: form.status,
      });
      if (!res.ok) {
        setFormError(res.message);
        return;
      }
      setDrawerOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Flotte"
        title={
          state.kind === "ok"
            ? `${state.data.code} · ${state.data.plate}`
            : "Véhicule"
        }
        description="Fiche Soft Glass · historique d’affectations (D254)."
        primary={
          state.kind === "ok" ? (
            <AButton type="button" size="sm" onClick={openEdit}>
              {LAYOUT_ACTIONS.edit}
            </AButton>
          ) : undefined
        }
      />
      <APageBody>
        <p className="mb-4 text-[length:var(--a-text-sm)]">
          <Link
            href="/fleet"
            className="text-a-accent underline-offset-2 hover:underline"
          >
            ← Flotte
          </Link>
          {" · "}
          <Link
            href="/fleet?tab=planning"
            className="text-a-fg-muted underline-offset-2 hover:underline"
          >
            Planning
          </Link>
        </p>

        {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
        {state.kind === "forbidden" && (
          <AForbiddenState message={state.message} />
        )}
        {state.kind === "error" && <AErrorState message={state.message} />}

        {state.kind === "ok" && (
          <>
            <APageSection title="Identité">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Item label="Code" value={state.data.code} />
                <Item label="Plaque" value={state.data.plate} mono />
                <Item
                  label="Statut"
                  value={
                    <ABadge tone={statusTone(state.data.status)}>
                      {FLEET_VEHICLE_STATUS_LABELS[state.data.status]}
                    </ABadge>
                  }
                />
                <Item
                  label="Froid"
                  value={state.data.cold ? "Oui" : "Non"}
                />
                <Item
                  label="Capacité (kg)"
                  value={state.data.capacityKg ?? "—"}
                  mono
                />
                <Item
                  label="Odomètre (km)"
                  value={state.data.odometerKm ?? "—"}
                  mono
                />
                <Item
                  label="Notes"
                  value={state.data.notes?.trim() || "—"}
                />
              </dl>
            </APageSection>

            <APageSection title="Affectations">
              {state.history.length === 0 ? (
                <AEmptyState
                  title="Aucune affectation"
                  description="Affectez ce véhicule depuis le planning flotte."
                />
              ) : (
                <ASoftTable>
                  <ASoftThead>
                    <tr>
                      <th>Date</th>
                      <th>Tournée</th>
                      <th>Chauffeur</th>
                      <th>Charge</th>
                      <th>État</th>
                    </tr>
                  </ASoftThead>
                  <tbody>
                    {state.history.map((a) => (
                      <ASoftTr key={a.id}>
                        <td className="tabular-nums">
                          {a.assignedAt.slice(0, 10)}
                        </td>
                        <td>
                          {a.round
                            ? `${a.round.date} · ${a.round.status}`
                            : a.roundId.slice(0, 8)}
                        </td>
                        <td>{a.driverLabel}</td>
                        <td className="tabular-nums">
                          {a.payloadKg ?? "—"}
                        </td>
                        <td>
                          <ABadge
                            tone={a.cancelledAt ? "neutral" : "success"}
                          >
                            {a.cancelledAt ? "Annulée" : "Ouverte"}
                          </ABadge>
                        </td>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
              )}
            </APageSection>
          </>
        )}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Modifier véhicule"
      >
        {form && (
          <div className="space-y-3">
            {formError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            )}
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
            <Field label="Statut">
              <select
                className={softSelect}
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as FleetVehicleStatus,
                  })
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FLEET_VEHICLE_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
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
                onClick={() => void onSave()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        )}
      </ADrawer>
    </>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "a-mono mt-0.5 text-[length:var(--a-text-sm)]"
            : "mt-0.5 text-[length:var(--a-text-sm)]"
        }
      >
        {value}
      </dd>
    </div>
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

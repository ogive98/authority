"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CircleDot,
  Coins,
  Droplets,
  Fuel,
  Gauge,
  NotebookPen,
  Tags,
  UserRound,
} from "lucide-react";
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
import { softFieldLabel, softSelect } from "@/lib/d294-ui";
import {
  FLEET_LOG_KIND_LABELS,
  FLEET_VEHICLE_STATUS_LABELS,
  createVehicleLog,
  fetchAssignments,
  fetchVehicle,
  fetchVehicleLogs,
  updateVehicle,
  type FleetAssignment,
  type FleetLogKind,
  type FleetVehicle,
  type FleetVehicleLog,
  type FleetVehicleStatus,
} from "@/lib/fleet";
import { fetchAssets, type MaintenanceAsset } from "@/lib/maintenance";

type Load =
  | {
      kind: "ok";
      data: FleetVehicle;
      history: FleetAssignment[];
      logs: FleetVehicleLog[];
    }
  | { kind: "loading" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type EditForm = {
  plate: string;
  capacityKg: string;
  cold: boolean;
  odometerKm: string;
  usualDriverLabel: string;
  nextServiceKm: string;
  nextServiceAt: string;
  notes: string;
  status: FleetVehicleStatus;
  version: number;
};

type LogForm = {
  kind: FleetLogKind;
  occurredAt: string;
  odometerKm: string;
  liters: string;
  amountTnd: string;
  notes: string;
};

const STATUSES = Object.keys(
  FLEET_VEHICLE_STATUS_LABELS,
) as FleetVehicleStatus[];

const LOG_KINDS = Object.keys(FLEET_LOG_KIND_LABELS) as FleetLogKind[];

function LogKindIcon({ kind }: { kind: FleetLogKind }) {
  const cls = "inline h-3.5 w-3.5 text-a-accent";
  if (kind === "ODOMETER") return <Gauge className={cls} aria-hidden />;
  if (kind === "OIL_CHANGE") return <Droplets className={cls} aria-hidden />;
  if (kind === "TIRES") return <CircleDot className={cls} aria-hidden />;
  if (kind === "FUEL") return <Fuel className={cls} aria-hidden />;
  return <NotebookPen className={cls} aria-hidden />;
}

function statusTone(
  s: FleetVehicleStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (s === "ACTIVE") return "success";
  if (s === "MAINTENANCE") return "warning";
  if (s === "OUT") return "danger";
  return "neutral";
}

function todayLocalIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function FleetVehiclePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [logForm, setLogForm] = useState<LogForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mntAsset, setMntAsset] = useState<MaintenanceAsset | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ kind: "loading" });
    const [vRes, aRes, lRes, mRes] = await Promise.all([
      fetchVehicle(id),
      fetchAssignments({ vehicleId: id, includeCancelled: true }),
      fetchVehicleLogs(id),
      fetchAssets({ vehicleId: id }),
    ]);
    if (!vRes.ok) {
      if (vRes.status === 403) {
        setState({ kind: "forbidden", message: vRes.message });
        return;
      }
      setState({ kind: "error", message: vRes.message });
      return;
    }
    setMntAsset(mRes.ok ? (mRes.data.items[0] ?? null) : null);
    setState({
      kind: "ok",
      data: vRes.data,
      history: aRes.ok ? aRes.data.items : [],
      logs: lRes.ok ? lRes.data.items : [],
    });
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
      usualDriverLabel: v.usualDriverLabel ?? "",
      nextServiceKm: v.nextServiceKm ?? "",
      nextServiceAt: v.nextServiceAt ?? "",
      notes: v.notes ?? "",
      status: v.status,
      version: v.version,
    });
    setFormError(null);
    setDrawerOpen(true);
  }

  function openLog(kind: FleetLogKind = "FUEL") {
    if (state.kind !== "ok") return;
    setLogForm({
      kind,
      occurredAt: todayLocalIsoDate(),
      odometerKm: state.data.odometerKm ?? "",
      liters: "",
      amountTnd: "",
      notes: "",
    });
    setFormError(null);
    setLogOpen(true);
  }

  async function onSave() {
    if (!form || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const cap = form.capacityKg.trim();
      const odo = form.odometerKm.trim();
      const nextKm = form.nextServiceKm.trim();
      const res = await updateVehicle(state.data.id, {
        version: form.version,
        plate: form.plate.trim(),
        capacityKg: cap ? Number(cap) : null,
        cold: form.cold,
        odometerKm: odo ? Number(odo) : null,
        usualDriverLabel: form.usualDriverLabel.trim() || null,
        nextServiceKm: nextKm ? Number(nextKm) : null,
        nextServiceAt: form.nextServiceAt || null,
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

  async function onSaveLog() {
    if (!logForm || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const odo = logForm.odometerKm.trim();
      const liters = logForm.liters.trim();
      const amount = logForm.amountTnd.trim();
      const res = await createVehicleLog(state.data.id, {
        kind: logForm.kind,
        occurredAt: new Date(`${logForm.occurredAt}T12:00:00.000Z`).toISOString(),
        odometerKm: odo ? Number(odo) : undefined,
        liters: liters ? Number(liters) : undefined,
        amountTnd: amount ? Number(amount) : undefined,
        notes: logForm.notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      setLogOpen(false);
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
        description="Fiche · chauffeur habitué · carnet (vidange, pneus, carburant, km) — D257."
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
          {mntAsset ? (
            <>
              {" · "}
              <Link
                href={`/maintenance/${mntAsset.id}`}
                className="text-a-accent underline-offset-2 hover:underline"
              >
                Équipement maintenance
              </Link>
            </>
          ) : null}
        </p>

        {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
        {state.kind === "forbidden" && (
          <AForbiddenState message={state.message} />
        )}
        {state.kind === "error" && <AErrorState message={state.message} />}

        {state.kind === "ok" && (
          <>
            {state.data.serviceDue ? (
              <p className="mb-4 text-[length:var(--a-text-sm)] text-[color:var(--a-warning)]">
                Entretien dû
                {state.data.nextServiceAt
                  ? ` · date ${state.data.nextServiceAt}`
                  : ""}
                {state.data.nextServiceKm
                  ? ` · prochain km ${state.data.nextServiceKm}`
                  : ""}
              </p>
            ) : null}

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
                  label="Chauffeur habitué"
                  value={state.data.usualDriverLabel?.trim() || "—"}
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
                  label="Prochain entretien (km)"
                  value={state.data.nextServiceKm ?? "—"}
                  mono
                />
                <Item
                  label="Prochain entretien (date)"
                  value={state.data.nextServiceAt ?? "—"}
                />
                <Item
                  label="Notes"
                  value={state.data.notes?.trim() || "—"}
                />
              </dl>
            </APageSection>

            <APageSection
              title="Carnet"
              action={
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => openLog("FUEL")}
                >
                  + Entrée carnet
                </AButton>
              }
            >
              {state.logs.length === 0 ? (
                <AEmptyState
                  title="Carnet vide"
                  description="Ajoutez vidange, pneus, carburant ou relevé km."
                  actionLabel="+ Entrée carnet"
                  onAction={() => openLog("OIL_CHANGE")}
                />
              ) : (
                <ASoftTable>
                  <ASoftThead>
                    <tr>
                      <th>
                        <span className={softFieldLabel}>
                          <CalendarDays aria-hidden />
                          Date
                        </span>
                      </th>
                      <th>
                        <span className={softFieldLabel}>
                          <Tags aria-hidden />
                          Type
                        </span>
                      </th>
                      <th>
                        <span className={softFieldLabel}>
                          <Gauge aria-hidden />
                          Km
                        </span>
                      </th>
                      <th>
                        <span className={softFieldLabel}>
                          <Fuel aria-hidden />
                          Litres
                        </span>
                      </th>
                      <th>
                        <span className={softFieldLabel}>
                          <Coins aria-hidden />
                          TND
                        </span>
                      </th>
                      <th>
                        <span className={softFieldLabel}>
                          <NotebookPen aria-hidden />
                          Notes
                        </span>
                      </th>
                    </tr>
                  </ASoftThead>
                  <tbody>
                    {state.logs.map((row) => (
                      <ASoftTr key={row.id}>
                        <td className="a-tabular">
                          {row.occurredAt.slice(0, 10)}
                        </td>
                        <td>
                          <span className="inline-flex items-center gap-1.5">
                            <LogKindIcon kind={row.kind} />
                            {FLEET_LOG_KIND_LABELS[row.kind]}
                          </span>
                        </td>
                        <td className="a-tabular">
                          {row.odometerKm ?? "—"}
                        </td>
                        <td className="a-tabular">{row.liters ?? "—"}</td>
                        <td className="a-tabular">
                          {row.amountTnd ?? "—"}
                        </td>
                        <td>{row.notes?.trim() || "—"}</td>
                      </ASoftTr>
                    ))}
                  </tbody>
                </ASoftTable>
              )}
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
                        <td className="a-tabular">
                          {a.assignedAt.slice(0, 10)}
                        </td>
                        <td>
                          {a.round
                            ? `${a.round.date} · ${a.round.status}`
                            : a.roundId.slice(0, 8)}
                        </td>
                        <td>{a.driverLabel}</td>
                        <td className="a-tabular">
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
            <Field label="Chauffeur habitué" icon={<UserRound />}>
              <AInput
                value={form.usualDriverLabel}
                onChange={(e) =>
                  setForm({ ...form, usualDriverLabel: e.target.value })
                }
                placeholder="Ex. Karim"
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
            <Field label="Prochain entretien (km)">
              <AInput
                value={form.nextServiceKm}
                onChange={(e) =>
                  setForm({ ...form, nextServiceKm: e.target.value })
                }
              />
            </Field>
            <Field label="Prochain entretien (date)">
              <AInput
                type="date"
                value={form.nextServiceAt}
                onChange={(e) =>
                  setForm({ ...form, nextServiceAt: e.target.value })
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

      <ADrawer
        open={logOpen}
        onOpenChange={setLogOpen}
        title="Entrée carnet"
      >
        {logForm && (
          <div className="space-y-3">
            {formError && (
              <p className="text-[length:var(--a-text-sm)] text-a-danger">
                {formError}
              </p>
            )}
            <Field label="Type" icon={<Tags />}>
              <select
                className={softSelect}
                value={logForm.kind}
                onChange={(e) =>
                  setLogForm({
                    ...logForm,
                    kind: e.target.value as FleetLogKind,
                  })
                }
              >
                {LOG_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {FLEET_LOG_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date" icon={<CalendarDays />}>
              <AInput
                type="date"
                value={logForm.occurredAt}
                onChange={(e) =>
                  setLogForm({ ...logForm, occurredAt: e.target.value })
                }
              />
            </Field>
            <Field label="Kilométrage" icon={<Gauge />}>
              <AInput
                value={logForm.odometerKm}
                onChange={(e) =>
                  setLogForm({ ...logForm, odometerKm: e.target.value })
                }
              />
            </Field>
            <Field label="Litres (carburant)" icon={<Fuel />}>
              <AInput
                value={logForm.liters}
                onChange={(e) =>
                  setLogForm({ ...logForm, liters: e.target.value })
                }
              />
            </Field>
            <Field label="Montant TND (optionnel)" icon={<Coins />}>
              <AInput
                value={logForm.amountTnd}
                onChange={(e) =>
                  setLogForm({ ...logForm, amountTnd: e.target.value })
                }
              />
            </Field>
            <Field label="Notes" icon={<NotebookPen />}>
              <AInput
                value={logForm.notes}
                onChange={(e) =>
                  setLogForm({ ...logForm, notes: e.target.value })
                }
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <AButton
                type="button"
                variant="secondary"
                onClick={() => setLogOpen(false)}
              >
                {LAYOUT_ACTIONS.cancel}
              </AButton>
              <AButton
                type="button"
                disabled={busy}
                onClick={() => void onSaveLog()}
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
  icon,
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={softFieldLabel}>
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
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
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softSelect } from "@/lib/d294-ui";
import { fetchVehicles, type FleetVehicle } from "@/lib/fleet";
import {
  MNT_ASSET_STATUS_LABELS,
  MNT_ASSET_TYPE_LABELS,
  MNT_WO_STATUS_LABELS,
  MNT_WO_TYPE_LABELS,
  completeWorkOrder,
  createWorkOrder,
  fetchAsset,
  fetchWorkOrders,
  markAssetDown,
  markAssetUp,
  openPreventiveWo,
  updateAsset,
  type MaintenanceAsset,
  type MaintenanceWo,
  type MntWoType,
} from "@/lib/maintenance";

type Load =
  | { kind: "ok"; data: MaintenanceAsset; wos: MaintenanceWo[] }
  | { kind: "loading" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type EditForm = {
  label: string;
  type: string;
  vehicleId: string;
  nextPreventiveAt: string;
  notes: string;
  version: number;
};

type WoForm = {
  type: MntWoType;
  title: string;
  notes: string;
};

const ASSET_TYPES = Object.keys(MNT_ASSET_TYPE_LABELS);

export default function MaintenanceAssetPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [woOpen, setWoOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [woForm, setWoForm] = useState<WoForm | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setState({ kind: "loading" });
    const [aRes, wRes] = await Promise.all([
      fetchAsset(id),
      fetchWorkOrders({ assetId: id }),
    ]);
    if (!aRes.ok) {
      if (aRes.status === 403) {
        setState({ kind: "forbidden", message: aRes.message });
        return;
      }
      setState({ kind: "error", message: aRes.message });
      return;
    }
    setState({
      kind: "ok",
      data: aRes.data,
      wos: wRes.ok ? wRes.data.items : [],
    });
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadFleetVehicles() {
    const res = await fetchVehicles({ status: "ACTIVE" });
    if (res.ok) setVehicles(res.data.items);
    else setVehicles([]);
  }

  function openEdit() {
    if (state.kind !== "ok") return;
    const a = state.data;
    setForm({
      label: a.label,
      type: a.type,
      vehicleId: a.vehicleId ?? "",
      nextPreventiveAt: a.nextPreventiveAt ?? "",
      notes: a.notes ?? "",
      version: a.version,
    });
    setFormError(null);
    void loadFleetVehicles();
    setDrawerOpen(true);
  }

  function openWoCreate(type: MntWoType = "BREAKDOWN") {
    if (state.kind !== "ok") return;
    setWoForm({
      type,
      title:
        type === "PREVENTIVE"
          ? `Préventif · ${state.data.code}`
          : `Panne · ${state.data.code}`,
      notes: "",
    });
    setFormError(null);
    setWoOpen(true);
  }

  async function onSave() {
    if (!form || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await updateAsset(state.data.id, {
        version: form.version,
        label: form.label.trim(),
        type: form.type,
        vehicleId: form.vehicleId || null,
        nextPreventiveAt: form.nextPreventiveAt || null,
        notes: form.notes.trim() || null,
      });
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      setDrawerOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus() {
    if (state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const a = state.data;
      const res =
        a.status === "ONLINE"
          ? await markAssetDown(a.id, a.version)
          : await markAssetUp(a.id, a.version);
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onOpenPreventive() {
    if (state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await openPreventiveWo(state.data.id);
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onSaveWo() {
    if (!woForm || state.kind !== "ok") return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await createWorkOrder({
        assetId: state.data.id,
        type: woForm.type,
        title: woForm.title.trim(),
        notes: woForm.notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      setWoOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function onCompleteWo(woId: string) {
    setBusy(true);
    setFormError(null);
    try {
      const res = await completeWorkOrder(woId);
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Maintenance"
        title={
          state.kind === "ok"
            ? `${state.data.code} · ${state.data.label}`
            : "Équipement"
        }
        description="Fiche · Down/Up · préventif ADV · historique OT · lien flotte (D258)."
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
            href="/maintenance"
            className="text-a-accent underline-offset-2 hover:underline"
          >
            ← Maintenance
          </Link>
          {" · "}
          <Link
            href="/maintenance?tab=wo"
            className="text-a-fg-muted underline-offset-2 hover:underline"
          >
            OT
          </Link>
        </p>

        {formError && !drawerOpen && !woOpen ? (
          <p className="mb-3 text-sm text-[color:var(--a-danger)]">{formError}</p>
        ) : null}

        {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
        {state.kind === "forbidden" && (
          <AForbiddenState message={state.message} />
        )}
        {state.kind === "error" && <AErrorState message={state.message} />}

        {state.kind === "ok" && (
          <>
            {state.data.preventiveDue ? (
              <div className="a-underlay mb-4 flex flex-wrap items-center justify-between gap-3 px-3 py-3">
                <p className="text-[length:var(--a-text-sm)] text-[color:var(--a-warning)]">
                  Préventif dû
                  {state.data.nextPreventiveAt
                    ? ` · ${state.data.nextPreventiveAt}`
                    : ""}
                </p>
                <AButton
                  type="button"
                  size="sm"
                  disabled={busy || !state.data.nextPreventiveAt}
                  onClick={() => void onOpenPreventive()}
                >
                  OT préventif
                </AButton>
              </div>
            ) : null}

            <APageSection
              title="Identité"
              action={
                <div className="flex flex-wrap gap-2">
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void onToggleStatus()}
                  >
                    {state.data.status === "ONLINE" ? "Down" : "Up"}
                  </AButton>
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => openWoCreate("BREAKDOWN")}
                  >
                    {LAYOUT_ACTIONS.newWo}
                  </AButton>
                </div>
              }
            >
              <dl className="grid gap-3 sm:grid-cols-2">
                <Item label="Code" value={state.data.code} mono />
                <Item label="Libellé" value={state.data.label} />
                <Item
                  label="Type"
                  value={MNT_ASSET_TYPE_LABELS[state.data.type] ?? state.data.type}
                />
                <Item
                  label="Statut"
                  value={
                    <ABadge
                      tone={
                        state.data.status === "ONLINE" ? "success" : "danger"
                      }
                    >
                      {MNT_ASSET_STATUS_LABELS[state.data.status]}
                    </ABadge>
                  }
                />
                <Item
                  label="Prochain préventif"
                  value={state.data.nextPreventiveAt ?? "—"}
                />
                <Item
                  label="Véhicule flotte"
                  value={
                    state.data.vehicleId && state.data.vehicle ? (
                      <Link
                        href={`/fleet/${state.data.vehicleId}`}
                        className="text-a-accent underline-offset-2 hover:underline"
                      >
                        {state.data.vehicle.code} · {state.data.vehicle.plate}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Item
                  label="Notes"
                  value={state.data.notes?.trim() || "—"}
                />
              </dl>
            </APageSection>

            <APageSection title="Historique OT">
              {state.wos.length === 0 ? (
                <AEmptyState
                  title="Aucun OT"
                  description="Ouvrez un OT panne ou préventif (ADV)."
                  actionLabel={LAYOUT_ACTIONS.newWo}
                  onAction={() => openWoCreate("BREAKDOWN")}
                />
              ) : (
                <ASoftTable>
                  <ASoftThead>
                    <tr>
                      <th>Titre</th>
                      <th>Type</th>
                      <th>Statut</th>
                      <th>Ouvert</th>
                      <th />
                    </tr>
                  </ASoftThead>
                  <tbody>
                    {state.wos.map((w) => (
                      <ASoftTr key={w.id}>
                        <td className="font-medium">{w.title}</td>
                        <td>{MNT_WO_TYPE_LABELS[w.type]}</td>
                        <td>
                          <ABadge
                            tone={w.status === "OPEN" ? "warning" : "success"}
                          >
                            {MNT_WO_STATUS_LABELS[w.status]}
                          </ABadge>
                        </td>
                        <td className="tabular-nums">
                          {new Date(w.openedAt).toLocaleString("fr-TN")}
                        </td>
                        <td className="text-right">
                          {w.status === "OPEN" ? (
                            <AButton
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => void onCompleteWo(w.id)}
                            >
                              Terminer
                            </AButton>
                          ) : null}
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
        title="Éditer équipement"
      >
        {form ? (
          <div className="flex flex-col gap-3">
            {formError ? (
              <p className="text-sm text-[color:var(--a-danger)]">{formError}</p>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              Libellé
              <AInput
                value={form.label}
                onChange={(e) =>
                  setForm({ ...form, label: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select
                className={softSelect}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MNT_ASSET_TYPE_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Véhicule flotte
              <select
                className={softSelect}
                value={form.vehicleId}
                onChange={(e) =>
                  setForm({ ...form, vehicleId: e.target.value })
                }
              >
                <option value="">— Aucun —</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} · {v.plate}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Prochain préventif
              <AInput
                type="date"
                value={form.nextPreventiveAt}
                onChange={(e) =>
                  setForm({ ...form, nextPreventiveAt: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Notes
              <AInput
                value={form.notes}
                onChange={(e) =>
                  setForm({ ...form, notes: e.target.value })
                }
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setDrawerOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy || !form.label.trim()}
                onClick={() => void onSave()}
              >
                {LAYOUT_ACTIONS.save}
              </AButton>
            </div>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer open={woOpen} onOpenChange={setWoOpen} title="Nouvel OT">
        {woForm ? (
          <div className="flex flex-col gap-3">
            {formError ? (
              <p className="text-sm text-[color:var(--a-danger)]">{formError}</p>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select
                className={softSelect}
                value={woForm.type}
                onChange={(e) =>
                  setWoForm({
                    ...woForm,
                    type: e.target.value as MntWoType,
                  })
                }
              >
                <option value="BREAKDOWN">{MNT_WO_TYPE_LABELS.BREAKDOWN}</option>
                <option value="PREVENTIVE">
                  {MNT_WO_TYPE_LABELS.PREVENTIVE}
                </option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Titre
              <AInput
                value={woForm.title}
                onChange={(e) =>
                  setWoForm({ ...woForm, title: e.target.value })
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Notes
              <AInput
                value={woForm.notes}
                onChange={(e) =>
                  setWoForm({ ...woForm, notes: e.target.value })
                }
              />
            </label>
            <div className="mt-2 flex justify-end gap-2">
              <AButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setWoOpen(false)}
              >
                Annuler
              </AButton>
              <AButton
                type="button"
                size="sm"
                disabled={busy || !woForm.title.trim()}
                onClick={() => void onSaveWo()}
              >
                {LAYOUT_ACTIONS.create}
              </AButton>
            </div>
          </div>
        ) : null}
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
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[length:var(--a-text-xs)] text-a-fg-muted">{label}</dt>
      <dd
        className={
          mono
            ? "mt-0.5 font-mono tabular-nums text-[length:var(--a-text-sm)]"
            : "mt-0.5 text-[length:var(--a-text-sm)]"
        }
      >
        {value}
      </dd>
    </div>
  );
}

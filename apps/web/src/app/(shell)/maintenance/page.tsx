"use client";

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
} from "@/components/a";
import { LAYOUT_ACTIONS } from "@/lib/layout-actions";
import { softChipClass, softSelect } from "@/lib/soft-glass-ui";
import { fetchVehicles, type FleetVehicle } from "@/lib/fleet";
import {
  MNT_ASSET_STATUS_LABELS,
  MNT_ASSET_TYPE_LABELS,
  MNT_WO_STATUS_LABELS,
  MNT_WO_TYPE_LABELS,
  completeWorkOrder,
  createAsset,
  createWorkOrder,
  fetchAssets,
  fetchWorkOrders,
  markAssetDown,
  markAssetUp,
  updateAsset,
  type MaintenanceAsset,
  type MaintenanceWo,
  type MntAssetStatus,
  type MntWoType,
} from "@/lib/maintenance";

type Tab = "assets" | "wo";

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; items: MaintenanceAsset[] }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string };

type AssetForm = {
  code: string;
  label: string;
  type: string;
  vehicleId: string;
  nextPreventiveAt: string;
  notes: string;
};

type WoForm = {
  assetId: string;
  type: MntWoType;
  title: string;
  notes: string;
};

function parseTab(raw: string | null): Tab {
  return raw === "wo" ? "wo" : "assets";
}

const ASSET_TYPES = Object.keys(MNT_ASSET_TYPE_LABELS);

export default function MaintenancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = parseTab(searchParams.get("tab"));

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | MntAssetStatus>("");
  const [dueOnly, setDueOnly] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<MaintenanceAsset | null>(null);
  const [form, setForm] = useState<AssetForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);

  const [woState, setWoState] = useState<
    "loading" | "ok" | "forbidden" | "error"
  >("loading");
  const [woError, setWoError] = useState<string | null>(null);
  const [workOrders, setWorkOrders] = useState<MaintenanceWo[]>([]);
  const [woOpen, setWoOpen] = useState(false);
  const [woForm, setWoForm] = useState<WoForm | null>(null);

  const setTab = useCallback(
    (next: Tab) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "assets") sp.delete("tab");
      else sp.set("tab", next);
      const qs = sp.toString();
      router.replace(qs ? `/maintenance?${qs}` : "/maintenance");
    },
    [router, searchParams],
  );

  const emptyForm = useCallback(
    (): AssetForm => ({
      code: "",
      label: "",
      type: "EQUIPMENT",
      vehicleId: "",
      nextPreventiveAt: "",
      notes: "",
    }),
    [],
  );

  const loadAssets = useCallback(
    async (
      query?: string,
      status?: "" | MntAssetStatus,
      preventiveDue?: boolean,
    ) => {
      setState({ kind: "loading" });
      const res = await fetchAssets({
        q: query,
        status: status || undefined,
        preventiveDue,
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

  const loadWo = useCallback(async () => {
    setWoState("loading");
    setWoError(null);
    const [aRes, wRes] = await Promise.all([
      fetchAssets(),
      fetchWorkOrders({ status: "OPEN" }),
    ]);
    if (!aRes.ok || !wRes.ok) {
      const fail = !aRes.ok ? aRes : wRes;
      if (fail.status === 403) {
        setWoState("forbidden");
        setWoError(fail.message);
        return;
      }
      setWoState("error");
      setWoError(fail.message);
      return;
    }
    setState({ kind: "ok", items: aRes.data.items });
    setWorkOrders(wRes.data.items);
    setWoState("ok");
  }, []);

  const loadFleetVehicles = useCallback(async () => {
    const res = await fetchVehicles({ status: "ACTIVE" });
    if (res.ok) setVehicles(res.data.items);
    else setVehicles([]);
  }, []);

  useEffect(() => {
    if (tab === "assets") void loadAssets(q, statusFilter, dueOnly);
    else void loadWo();
  }, [tab, loadAssets, loadWo, statusFilter, dueOnly]);

  const assets = useMemo(
    () => (state.kind === "ok" ? state.items : []),
    [state],
  );

  function openCreate() {
    setEditAsset(null);
    setForm(emptyForm());
    setFormError(null);
    void loadFleetVehicles();
    setDrawerOpen(true);
  }

  function openEdit(asset: MaintenanceAsset) {
    setEditAsset(asset);
    setForm({
      code: asset.code,
      label: asset.label,
      type: asset.type,
      vehicleId: asset.vehicleId ?? "",
      nextPreventiveAt: asset.nextPreventiveAt ?? "",
      notes: asset.notes ?? "",
    });
    setFormError(null);
    void loadFleetVehicles();
    setDrawerOpen(true);
  }

  async function onSaveAsset() {
    if (!form) return;
    setBusy(true);
    setFormError(null);
    try {
      if (editAsset) {
        const res = await updateAsset(editAsset.id, {
          version: editAsset.version,
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
      } else {
        const res = await createAsset({
          code: form.code.trim(),
          label: form.label.trim(),
          type: form.type,
          vehicleId: form.vehicleId || null,
          nextPreventiveAt: form.nextPreventiveAt || null,
          notes: form.notes.trim() || undefined,
        });
        if (!res.ok) {
          setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
          return;
        }
      }
      setDrawerOpen(false);
      await loadAssets(q, statusFilter, dueOnly);
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus(asset: MaintenanceAsset) {
    setBusy(true);
    setFormError(null);
    try {
      const res =
        asset.status === "ONLINE"
          ? await markAssetDown(asset.id, asset.version)
          : await markAssetUp(asset.id, asset.version);
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      if (tab === "assets") await loadAssets(q, statusFilter, dueOnly);
      else await loadWo();
    } finally {
      setBusy(false);
    }
  }

  function openWoCreate(assetId?: string) {
    setWoForm({
      assetId: assetId ?? assets[0]?.id ?? "",
      type: "BREAKDOWN",
      title: "",
      notes: "",
    });
    setFormError(null);
    setWoOpen(true);
  }

  async function onSaveWo() {
    if (!woForm) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await createWorkOrder({
        assetId: woForm.assetId,
        type: woForm.type,
        title: woForm.title.trim(),
        notes: woForm.notes.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      setWoOpen(false);
      await loadWo();
      setTab("wo");
    } finally {
      setBusy(false);
    }
  }

  async function onCompleteWo(id: string) {
    setBusy(true);
    setWoError(null);
    try {
      const res = await completeWorkOrder(id);
      if (!res.ok) {
        setWoError(res.code ? `${res.code} — ${res.message}` : res.message);
        return;
      }
      await loadWo();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AScreenHeader
        kicker="Maintenance"
        title="Équipements & OT"
        description="Soft Glass V0 · lien flotte optionnel · date préventive UI · pas de job Thunder (D256)."
        primary={
          tab === "assets" ? (
            <AButton type="button" size="sm" onClick={openCreate}>
              {LAYOUT_ACTIONS.newAsset}
            </AButton>
          ) : (
            <AButton type="button" size="sm" onClick={() => openWoCreate()}>
              {LAYOUT_ACTIONS.newWo}
            </AButton>
          )
        }
      />
      <APageBody>
        <div className="mb-4 flex gap-2">
          <AButton
            type="button"
            size="sm"
            variant={tab === "assets" ? "primary" : "secondary"}
            onClick={() => setTab("assets")}
          >
            Équipements
          </AButton>
          <AButton
            type="button"
            size="sm"
            variant={tab === "wo" ? "primary" : "secondary"}
            onClick={() => setTab("wo")}
          >
            OT
          </AButton>
        </div>

        {tab === "assets" && (
          <>
            <AFilterBar
              search={
                <AInput
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      void loadAssets(q, statusFilter, dueOnly);
                  }}
                  placeholder="Code, libellé…"
                  aria-label="Recherche équipements"
                />
              }
              filters={
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "" as const, label: "Tous" },
                      { id: "ONLINE" as const, label: "En ligne" },
                      { id: "DOWN" as const, label: "Hors service" },
                    ] as const
                  ).map((chip) => (
                    <button
                      key={chip.id || "all"}
                      type="button"
                      className={softChipClass(statusFilter === chip.id)}
                      onClick={() => setStatusFilter(chip.id)}
                    >
                      {chip.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={softChipClass(dueOnly)}
                    onClick={() => setDueOnly((v) => !v)}
                  >
                    Préventif dû
                  </button>
                </div>
              }
              utilities={
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void loadAssets(q, statusFilter, dueOnly)}
                >
                  Filtrer
                </AButton>
              }
            />

            {formError && tab === "assets" && !drawerOpen ? (
              <p className="mb-3 text-sm text-[color:var(--a-danger)]">
                {formError}
              </p>
            ) : null}

            {state.kind === "loading" && <ASkeleton className="h-40 w-full" />}
            {state.kind === "forbidden" && (
              <AForbiddenState message={state.message} />
            )}
            {state.kind === "error" && (
              <AErrorState message={state.message} />
            )}
            {state.kind === "ok" && state.items.length === 0 && (
              <AEmptyState
                title="Aucun équipement"
                description="Créez une cuve, presse, chambre froide ou lien véhicule flotte."
              />
            )}
            {state.kind === "ok" && state.items.length > 0 && (
              <ASoftTable>
                <ASoftThead>
                  <tr>
                    <th>Code</th>
                    <th>Libellé</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Préventif</th>
                    <th>Flotte</th>
                    <th />
                  </tr>
                </ASoftThead>
                <tbody>
                  {state.items.map((a) => (
                    <ASoftTr key={a.id}>
                      <td className="font-medium">{a.code}</td>
                      <td>{a.label}</td>
                      <td>
                        {MNT_ASSET_TYPE_LABELS[a.type] ?? a.type}
                      </td>
                      <td>
                        <ABadge
                          tone={a.status === "ONLINE" ? "success" : "danger"}
                        >
                          {MNT_ASSET_STATUS_LABELS[a.status]}
                        </ABadge>
                      </td>
                      <td>
                        {a.nextPreventiveAt ? (
                          <span
                            className={
                              a.preventiveDue
                                ? "text-[color:var(--a-warning)]"
                                : undefined
                            }
                          >
                            {a.nextPreventiveAt}
                            {a.preventiveDue ? " · dû" : ""}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {a.vehicle
                          ? `${a.vehicle.code} · ${a.vehicle.plate}`
                          : "—"}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void onToggleStatus(a)}
                          >
                            {a.status === "ONLINE" ? "Down" : "Up"}
                          </AButton>
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(a)}
                          >
                            Éditer
                          </AButton>
                          <AButton
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => openWoCreate(a.id)}
                          >
                            OT
                          </AButton>
                        </div>
                      </td>
                    </ASoftTr>
                  ))}
                </tbody>
              </ASoftTable>
            )}
          </>
        )}

        {tab === "wo" && (
          <>
            {woError ? (
              <p className="mb-3 text-sm text-[color:var(--a-danger)]">
                {woError}
              </p>
            ) : null}
            {woState === "loading" && <ASkeleton className="h-40 w-full" />}
            {woState === "forbidden" && (
              <AForbiddenState message={woError ?? "Accès refusé"} />
            )}
            {woState === "error" && (
              <AErrorState message={woError ?? "Erreur"} />
            )}
            {woState === "ok" && workOrders.length === 0 && (
              <AEmptyState
                title="Aucun OT ouvert"
                description="Ouvrez un OT panne ou préventif depuis un équipement."
              />
            )}
            {woState === "ok" && workOrders.length > 0 && (
              <ASoftTable>
                <ASoftThead>
                  <tr>
                    <th>Titre</th>
                    <th>Type</th>
                    <th>Équipement</th>
                    <th>Statut</th>
                    <th>Ouvert</th>
                    <th />
                  </tr>
                </ASoftThead>
                <tbody>
                  {workOrders.map((w) => (
                    <ASoftTr key={w.id}>
                      <td className="font-medium">{w.title}</td>
                      <td>{MNT_WO_TYPE_LABELS[w.type]}</td>
                      <td>
                        {w.asset
                          ? `${w.asset.code} · ${w.asset.label}`
                          : w.assetId.slice(0, 8)}
                      </td>
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
          </>
        )}
      </APageBody>

      <ADrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editAsset ? "Éditer équipement" : "Nouvel équipement"}
      >
        {form ? (
          <div className="flex flex-col gap-3">
            {formError ? (
              <p className="text-sm text-[color:var(--a-danger)]">{formError}</p>
            ) : null}
            {!editAsset ? (
              <label className="flex flex-col gap-1 text-sm">
                Code
                <AInput
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                />
              </label>
            ) : (
              <p className="text-sm text-[color:var(--a-muted)]">
                Code · {editAsset.code}
              </p>
            )}
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
                    {MNT_ASSET_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Véhicule flotte (optionnel)
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
            <AButton
              type="button"
              disabled={busy}
              onClick={() => void onSaveAsset()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          </div>
        ) : null}
      </ADrawer>

      <ADrawer
        open={woOpen}
        onOpenChange={setWoOpen}
        title="Nouvel OT"
      >
        {woForm ? (
          <div className="flex flex-col gap-3">
            {formError ? (
              <p className="text-sm text-[color:var(--a-danger)]">{formError}</p>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              Équipement
              <select
                className={softSelect}
                value={woForm.assetId}
                onChange={(e) =>
                  setWoForm({ ...woForm, assetId: e.target.value })
                }
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.label}
                  </option>
                ))}
              </select>
            </label>
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
                <option value="BREAKDOWN">Panne</option>
                <option value="PREVENTIVE">Préventif</option>
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
            <AButton
              type="button"
              disabled={busy || !woForm.assetId}
              onClick={() => void onSaveWo()}
            >
              {LAYOUT_ACTIONS.save}
            </AButton>
          </div>
        ) : null}
      </ADrawer>
    </>
  );
}

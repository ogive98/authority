export type MntAssetStatus = "ONLINE" | "DOWN";
export type MntWoStatus = "OPEN" | "DONE";
export type MntWoType = "BREAKDOWN" | "PREVENTIVE";

export const MNT_ASSET_STATUS_LABELS: Record<MntAssetStatus, string> = {
  ONLINE: "En ligne",
  DOWN: "Hors service",
};

export const MNT_WO_STATUS_LABELS: Record<MntWoStatus, string> = {
  OPEN: "Ouvert",
  DONE: "Terminé",
};

export const MNT_WO_TYPE_LABELS: Record<MntWoType, string> = {
  BREAKDOWN: "Panne",
  PREVENTIVE: "Préventif",
};

export const MNT_ASSET_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: "Équipement",
  VEHICLE: "Véhicule",
  COLD_ROOM: "Chambre froide",
  PRESS: "Presse",
  OTHER: "Autre",
};

export type MaintenanceAsset = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  type: string;
  status: MntAssetStatus;
  vehicleId: string | null;
  nextPreventiveAt: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  vehicle?: { id: string; code: string; plate: string } | null;
  preventiveDue: boolean;
};

export type MaintenanceWo = {
  id: string;
  companyId: string;
  assetId: string;
  type: MntWoType;
  status: MntWoStatus;
  title: string;
  notes: string | null;
  openedAt: string;
  doneAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  asset?: {
    id: string;
    code: string;
    label: string;
    type: string;
    status: MntAssetStatus;
  };
};

type ApiFail = { ok: false; status: number; message: string; code?: string };

async function parseFail(res: Response): Promise<ApiFail> {
  let message = res.statusText || "Erreur";
  let code: string | undefined;
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      code?: string;
    };
    if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (typeof body.message === "string") message = body.message;
    if (typeof body.code === "string") code = body.code;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message, code };
}

export async function fetchAssets(opts?: {
  q?: string;
  status?: MntAssetStatus | "";
  preventiveDue?: boolean;
  vehicleId?: string;
}): Promise<{ ok: true; data: { items: MaintenanceAsset[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.q?.trim()) sp.set("q", opts.q.trim());
  if (opts?.status) sp.set("status", opts.status);
  if (opts?.preventiveDue) sp.set("preventiveDue", "1");
  if (opts?.vehicleId?.trim()) sp.set("vehicleId", opts.vehicleId.trim());
  const qs = sp.toString();
  const res = await fetch(`/api/v1/maintenance/assets${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: MaintenanceAsset[] },
  };
}

export async function fetchAsset(
  id: string,
): Promise<{ ok: true; data: MaintenanceAsset } | ApiFail> {
  const res = await fetch(`/api/v1/maintenance/assets/${id}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceAsset };
}

export async function openPreventiveWo(
  assetId: string,
): Promise<{ ok: true; data: MaintenanceWo } | ApiFail> {
  const res = await fetch(
    `/api/v1/maintenance/assets/${assetId}/open-preventive`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceWo };
}

export async function createAsset(body: {
  code: string;
  label: string;
  type: string;
  vehicleId?: string | null;
  nextPreventiveAt?: string | null;
  notes?: string;
}): Promise<{ ok: true; data: MaintenanceAsset } | ApiFail> {
  const res = await fetch("/api/v1/maintenance/assets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceAsset };
}

export async function updateAsset(
  id: string,
  body: {
    version: number;
    label?: string;
    type?: string;
    status?: MntAssetStatus;
    vehicleId?: string | null;
    nextPreventiveAt?: string | null;
    notes?: string | null;
  },
): Promise<{ ok: true; data: MaintenanceAsset } | ApiFail> {
  const res = await fetch(`/api/v1/maintenance/assets/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceAsset };
}

export async function markAssetDown(
  id: string,
  version: number,
): Promise<{ ok: true; data: MaintenanceAsset } | ApiFail> {
  const res = await fetch(`/api/v1/maintenance/assets/${id}/down`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceAsset };
}

export async function markAssetUp(
  id: string,
  version: number,
): Promise<{ ok: true; data: MaintenanceAsset } | ApiFail> {
  const res = await fetch(`/api/v1/maintenance/assets/${id}/up`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceAsset };
}

export async function fetchWorkOrders(opts?: {
  assetId?: string;
  status?: MntWoStatus | "";
}): Promise<{ ok: true; data: { items: MaintenanceWo[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.assetId) sp.set("assetId", opts.assetId);
  if (opts?.status) sp.set("status", opts.status);
  const qs = sp.toString();
  const res = await fetch(`/api/v1/maintenance/maint-wo${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: MaintenanceWo[] },
  };
}

export async function createWorkOrder(body: {
  assetId: string;
  type: MntWoType;
  title: string;
  notes?: string;
}): Promise<{ ok: true; data: MaintenanceWo } | ApiFail> {
  const res = await fetch("/api/v1/maintenance/maint-wo", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceWo };
}

export async function completeWorkOrder(
  id: string,
): Promise<{ ok: true; data: MaintenanceWo } | ApiFail> {
  const res = await fetch(`/api/v1/maintenance/maint-wo/${id}/complete`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as MaintenanceWo };
}

/** Client helpers for Traceability (`/api/v1/traceability`). */

export type TrcLot = {
  id: string;
  lotCode: string;
  productId: string;
  productionDate: string | null;
  expiryDate: string | null;
  createdAt: string;
};

export type TrcLink = {
  id: string;
  parentLotId: string;
  childLotId: string;
  qty: string;
  createdAt: string;
};

export type TrcRecall = {
  id: string;
  lotId: string;
  reason: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  initiatedBy: string;
  createdAt: string;
  completedAt: string | null;
};

export type LotTree = {
  lot: TrcLot;
  parents: { lot: TrcLot; qty: string }[];
  children: { lot: TrcLot; qty: string }[];
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store", ...init });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, status: res.status, message: body.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchLots(productId?: string): Promise<ApiResult<TrcLot[]>> {
  const q = productId ? `?productId=${productId}` : "";
  return api<TrcLot[]>(`/api/v1/traceability/lots${q}`);
}

export async function createLot(body: { lotCode: string; productId: string; productionDate?: string; expiryDate?: string }): Promise<ApiResult<TrcLot>> {
  return api<TrcLot>("/api/v1/traceability/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchLotTree(id: string): Promise<ApiResult<LotTree>> {
  return api<LotTree>(`/api/v1/traceability/lots/${id}/tree`);
}

export async function linkLots(body: { parentLotId: string; childLotId: string; qty: string }): Promise<ApiResult<TrcLink>> {
  return api<TrcLink>("/api/v1/traceability/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchRecalls(): Promise<ApiResult<TrcRecall[]>> {
  return api<TrcRecall[]>("/api/v1/traceability/recalls");
}

export async function createRecall(body: { lotId: string; reason: string; initiatedBy: string }): Promise<ApiResult<TrcRecall>> {
  return api<TrcRecall>("/api/v1/traceability/recalls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function completeRecall(id: string): Promise<ApiResult<TrcRecall>> {
  return api<TrcRecall>(`/api/v1/traceability/recalls/${id}/complete`, { method: "POST" });
}

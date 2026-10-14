/** Client helpers for Costing (`/api/v1/costing`). */

export type CostRoll = {
  id: string;
  productId: string;
  period: string;
  stdCost: string;
  postedAt: string;
};

export type CostLot = {
  id: string;
  lotId: string;
  unitCost: string;
  totalCost: string;
};

export type ProductCost = {
  product: { id: string; sku: string; name: string };
  stdCost: string;
  period: string;
  rolls: CostRoll[];
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

export async function fetchRolls(): Promise<ApiResult<CostRoll[]>> {
  return api<CostRoll[]>("/api/v1/costing/rolls");
}

export async function runRollup(period: string): Promise<ApiResult<CostRoll[]>> {
  return api<CostRoll[]>("/api/v1/costing/rollups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ period }) });
}

export async function fetchProductCost(productId: string): Promise<ApiResult<ProductCost>> {
  return api<ProductCost>(`/api/v1/costing/products/${productId}`);
}

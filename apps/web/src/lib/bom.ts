/** Client helpers for BOM Recipes (`/api/v1/bom`). */

export type RecipeStatus = "DRAFT" | "ACTIVE" | "OBSOLETE";

export type RecipeLine = {
  id: string;
  productId: string;
  qty: string;
  uom: string;
  scrapPct: string;
  step: number | null;
};

export type BomRecipe = {
  id: string;
  number: string;
  productId: string;
  version: number;
  status: RecipeStatus;
  yield: string;
  notes: string | null;
  lines: RecipeLine[];
  createdAt: string;
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

export async function fetchRecipes(): Promise<ApiResult<BomRecipe[]>> {
  return api<BomRecipe[]>("/api/v1/bom/recipes");
}

export async function fetchRecipe(id: string): Promise<ApiResult<BomRecipe>> {
  return api<BomRecipe>(`/api/v1/bom/recipes/${id}`);
}

export async function createRecipe(body: { productId: string; version: number; yield?: string; notes?: string }): Promise<ApiResult<BomRecipe>> {
  return api<BomRecipe>("/api/v1/bom/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function addRecipeLines(id: string, lines: { productId: string; qty: string; uom: string; scrapPct?: string; step?: number }[]): Promise<ApiResult<BomRecipe>> {
  return api<BomRecipe>(`/api/v1/bom/recipes/${id}/lines`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lines }) });
}

export async function activateRecipe(id: string): Promise<ApiResult<BomRecipe>> {
  return api<BomRecipe>(`/api/v1/bom/recipes/${id}/activate`, { method: "POST" });
}

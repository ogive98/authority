/** Client helpers for Production light (`/api/v1/production`). */

export type WorkOrder = {
  id: string;
  number: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  plannedQty: string;
  actualQty: string | null;
  lotOut: string | null;
  status: string;
  notes: string | null;
  yieldRatio: string | null;
  consumptions: Array<{
    id: string;
    productId: string;
    qty: string;
    lotIn: string | null;
  }>;
  outputs: Array<{
    id: string;
    productId: string;
    qty: string;
    lotOut: string | null;
  }>;
  scraps: Array<{
    id: string;
    productId: string;
    qty: string;
    reason: string | null;
  }>;
  createdAt: string;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  trackLot?: boolean;
};

export type WarehouseOption = {
  id: string;
  code: string;
  name: string;
};

type ApiFail = { ok: false; status: number; message: string };
type ApiOk<T> = { ok: true; data: T };

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[]; code?: string };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.code) return body.code;
  } catch {
    /* ignore */
  }
  return res.statusText || "Erreur réseau";
}

export async function fetchWorkOrders(
  q?: string,
  status?: string,
): Promise<ApiOk<{ items: WorkOrder[] }> | ApiFail> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const qs = params.toString();
  const res = await fetch(
    qs ? `/api/v1/production/work-orders?${qs}` : "/api/v1/production/work-orders",
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: WorkOrder[] } };
}

export async function createWorkOrder(body: {
  productId: string;
  warehouseId: string;
  plannedQty: number;
  lotOut?: string;
  notes?: string;
}): Promise<ApiOk<WorkOrder> | ApiFail> {
  const res = await fetch("/api/v1/production/work-orders", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as WorkOrder };
}

export async function releaseWorkOrder(
  id: string,
): Promise<ApiOk<WorkOrder> | ApiFail> {
  const res = await fetch(`/api/v1/production/work-orders/${id}/release`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as WorkOrder };
}

export async function declareWorkOrder(
  id: string,
  body: {
    consumptions: Array<{ productId: string; qty: number; lotIn?: string }>;
    outputQty: number;
    lotOut?: string;
    scrapQty?: number;
    scrapReason?: string;
  },
): Promise<ApiOk<WorkOrder> | ApiFail> {
  const res = await fetch(`/api/v1/production/work-orders/${id}/declare`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as WorkOrder };
}

export async function fetchActiveProducts(): Promise<
  ApiOk<{ items: ProductOption[] }> | ApiFail
> {
  const res = await fetch("/api/v1/products", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  const data = (await res.json()) as {
    items: Array<{
      id: string;
      sku: string;
      name: string;
      status?: string;
      trackLot?: boolean;
    }>;
  };
  return {
    ok: true,
    data: {
      items: data.items
        .filter((p) => !p.status || p.status === "ACTIVE" || p.status === "DRAFT")
        .map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          trackLot: Boolean(p.trackLot),
        })),
    },
  };
}

export async function fetchWarehouses(): Promise<
  ApiOk<{ items: WarehouseOption[] }> | ApiFail
> {
  const res = await fetch("/api/v1/inventory/warehouses", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  const data = (await res.json()) as {
    items: Array<{ id: string; code: string; name: string }>;
  };
  return { ok: true, data };
}

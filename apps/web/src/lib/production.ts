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

/** D292 — Digital worksheet Prep→Weigh→Control. */
export type WorksheetLine = {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  requestedQty: string;
  preparedQty: string | null;
  weighedQty: string | null;
  unit: string;
  lot: string | null;
  notes: string | null;
};

export type Worksheet = {
  id: string;
  number: string;
  status: string;
  orderId: string | null;
  workOrderId: string | null;
  notes: string | null;
  controlResult: string | null;
  controlNote: string | null;
  preparedAt: string | null;
  weighedAt: string | null;
  controlledAt: string | null;
  version: number;
  lines: WorksheetLine[];
  createdAt: string;
};

export async function fetchWorksheets(
  q?: string,
  status?: string,
): Promise<ApiOk<{ items: Worksheet[] }> | ApiFail> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const qs = params.toString();
  const res = await fetch(
    qs
      ? `/api/v1/production/worksheets?${qs}`
      : "/api/v1/production/worksheets",
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: Worksheet[] } };
}

export async function createWorksheet(body: {
  lines: Array<{
    productId: string;
    requestedQty: number;
    unit?: string;
    lot?: string;
    notes?: string;
  }>;
  notes?: string;
  orderId?: string;
  workOrderId?: string;
}): Promise<ApiOk<Worksheet> | ApiFail> {
  const res = await fetch("/api/v1/production/worksheets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Worksheet };
}

export async function prepareWorksheet(
  id: string,
  lines: Array<{ id: string; qty: number; lot?: string }>,
): Promise<ApiOk<Worksheet> | ApiFail> {
  const res = await fetch(`/api/v1/production/worksheets/${id}/prepare`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Worksheet };
}

export async function weighWorksheet(
  id: string,
  lines: Array<{ id: string; qty: number; lot?: string }>,
): Promise<ApiOk<Worksheet> | ApiFail> {
  const res = await fetch(`/api/v1/production/worksheets/${id}/weigh`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Worksheet };
}

export async function controlWorksheet(
  id: string,
  body: { result: "PASS" | "FAIL"; note?: string },
): Promise<ApiOk<Worksheet> | ApiFail> {
  const res = await fetch(`/api/v1/production/worksheets/${id}/control`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Worksheet };
}

export async function cancelWorksheet(
  id: string,
): Promise<ApiOk<Worksheet> | ApiFail> {
  const res = await fetch(`/api/v1/production/worksheets/${id}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Worksheet };
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

export type InventoryBalance = {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  onHand: string;
  reserved: string;
  available: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type InventoryWarehouse = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
};

export type BalanceListResponse = {
  items: InventoryBalance[];
  nextCursor: string | null;
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  status: string;
  trackLot?: boolean;
};

export type InventoryLot = {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  lotCode: string;
  qtyOnHand: string;
  qtyReserved: string;
  available: string;
  dlc: string | null;
  status: "OPEN" | "QUARANTINE" | "CLOSED";
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type LotListResponse = {
  items: InventoryLot[];
  nextCursor: string | null;
};

type ApiFail = { ok: false; status: number; code?: string; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  return {
    ok: false,
    status: res.status,
    code: body.code,
    message: body.message ?? `HTTP ${res.status}`,
  };
}

export async function fetchWarehouses(): Promise<
  { ok: true; items: InventoryWarehouse[] } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/inventory/warehouses", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as { items: InventoryWarehouse[] };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchBalances(q?: string): Promise<
  { ok: true; data: BalanceListResponse } | ApiFail
> {
  try {
    const url = q?.trim()
      ? `/api/v1/inventory/balances?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/inventory/balances";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as BalanceListResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchActiveProducts(): Promise<
  { ok: true; items: ProductOption[] } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/products", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as {
      items: ProductOption[];
    };
    return {
      ok: true,
      items: data.items.filter((p) => p.status === "ACTIVE" || p.status === "DRAFT"),
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function adjustStock(body: {
  productId: string;
  warehouseId: string;
  qtyDelta: number;
  reason?: string;
  lotCode?: string;
  dlc?: string;
}): Promise<{ ok: true; data: InventoryBalance } | ApiFail> {
  try {
    const res = await fetch("/api/v1/inventory/adjust", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as InventoryBalance;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchLots(opts?: {
  q?: string;
  status?: string;
}): Promise<{ ok: true; data: LotListResponse } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status && opts.status !== "all") params.set("status", opts.status);
    const qs = params.toString();
    const res = await fetch(
      qs ? `/api/v1/inventory/lots?${qs}` : "/api/v1/inventory/lots",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as LotListResponse;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createLot(body: {
  productId: string;
  warehouseId: string;
  lotCode: string;
  dlc?: string;
  status?: string;
  initialQty?: number;
}): Promise<{ ok: true; data: InventoryLot } | ApiFail> {
  try {
    const res = await fetch("/api/v1/inventory/lots", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as InventoryLot;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function adjustLot(body: {
  lotId: string;
  qtyDelta: number;
  reason?: string;
}): Promise<{ ok: true; data: InventoryLot } | ApiFail> {
  try {
    const res = await fetch("/api/v1/inventory/lots/adjust", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as InventoryLot;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function patchLotStatus(
  lotId: string,
  status: string,
): Promise<{ ok: true; data: InventoryLot } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/inventory/lots/${lotId}/status`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as InventoryLot;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

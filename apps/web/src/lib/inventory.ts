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
  packDate?: string | null;
  productionDate?: string | null;
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

export type CheeseArticle = {
  id: string;
  companyId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  productUom: string | null;
  shelfLifeDays: number;
  active: boolean;
  notes: string | null;
  version: number;
  sampleDlcToday: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchCheeseArticles(opts?: {
  activeOnly?: boolean;
}): Promise<{ ok: true; items: CheeseArticle[] } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.activeOnly === true) params.set("active", "1");
    if (opts?.activeOnly === false) params.set("active", "0");
    const qs = params.toString();
    const res = await fetch(
      qs
        ? `/api/v1/inventory/cheese-articles?${qs}`
        : "/api/v1/inventory/cheese-articles",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as { items: CheeseArticle[] };
    return { ok: true, items: data.items };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function upsertCheeseArticle(body: {
  productId: string;
  shelfLifeDays: number;
  active?: boolean;
  notes?: string;
}): Promise<{ ok: true; data: CheeseArticle } | ApiFail> {
  try {
    const res = await fetch("/api/v1/inventory/cheese-articles", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as CheeseArticle;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function patchCheeseArticle(
  id: string,
  body: { shelfLifeDays?: number; active?: boolean; notes?: string },
): Promise<{ ok: true; data: CheeseArticle } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/inventory/cheese-articles/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as CheeseArticle;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type DailyLotGenResult = {
  packDate: string;
  warehouseId: string;
  created: number;
  skipped: number;
  items: Array<{
    lotCode: string;
    productSku: string;
    dlc: string;
    status: "created" | "skipped";
  }>;
};

export async function generateDailyCheeseLots(body?: {
  packDate?: string;
  warehouseId?: string;
}): Promise<{ ok: true; data: DailyLotGenResult } | ApiFail> {
  try {
    const res = await fetch("/api/v1/inventory/cheese-articles/generate-daily", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as DailyLotGenResult;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type SalubritaCertificateItem = {
  productId: string;
  productSku: string;
  productName: string;
  productionDate: string;
  packDate: string;
  dlc: string;
  daysAfterPack: number;
  lotCode: string | null;
  shelfLifeDays: number;
};

export type SalubritaCertificate = {
  packDate: string;
  warehouseId: string | null;
  source?: "snapshot" | "live";
  items: SalubritaCertificateItem[];
};

export type SalubritaHistoryItem = {
  packDate: string;
  lineCount: number;
  updatedAt: string;
  source: "snapshot" | "live";
};

export async function fetchSalubritaHistory(): Promise<
  | {
      ok: true;
      data: {
        days: number;
        fromDate: string;
        toDate: string;
        items: SalubritaHistoryItem[];
      };
    }
  | ApiFail
> {
  try {
    const res = await fetch("/api/v1/inventory/salubrita/history", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as {
      days: number;
      fromDate: string;
      toDate: string;
      items: SalubritaHistoryItem[];
    };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchSalubritaCertificate(opts?: {
  packDate?: string;
  warehouseId?: string;
}): Promise<{ ok: true; data: SalubritaCertificate } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.packDate) params.set("packDate", opts.packDate);
    if (opts?.warehouseId) params.set("warehouseId", opts.warehouseId);
    const qs = params.toString();
    const res = await fetch(
      qs
        ? `/api/v1/inventory/salubrita/certificate?${qs}`
        : "/api/v1/inventory/salubrita/certificate",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as SalubritaCertificate;
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type SalubritaRecipient = {
  id: string;
  code: string;
  legalName: string;
  nickname: string | null;
  email: string | null;
  whatsapp: string | null;
  salubritaEmail: boolean;
  salubritaWhatsapp: boolean;
  salubritaPortal: boolean;
};

export async function fetchSalubritaRecipients(opts: {
  channel: "email" | "whatsapp" | "portal";
  q?: string;
}): Promise<
  | { ok: true; data: { channel: string; items: SalubritaRecipient[] } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    params.set("channel", opts.channel);
    if (opts.q?.trim()) params.set("q", opts.q.trim());
    const res = await fetch(
      `/api/v1/inventory/salubrita/recipients?${params.toString()}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as {
      channel: string;
      items: SalubritaRecipient[];
    };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

/** D128 — download Word model (OOXML as .docx). */
export async function downloadSalubritaTemplate(): Promise<
  { ok: true } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/inventory/salubrita/template", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "certificat-salubrita-template.docx";
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

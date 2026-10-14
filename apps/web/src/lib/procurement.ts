/** Client helpers for Procurement (`/api/v1/procurement`) — D324. */

export type SuggestionStatus = "OPEN" | "APPROVED" | "REJECTED" | "CONVERTED";
export type SuggestionReason = "MIN" | "SAFETY" | "FORECAST" | "MANUAL";
export type PoStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "APPROVED"
  | "SENT"
  | "CONFIRMED"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";
export type PoLineStatus = "OPEN" | "PARTIAL" | "CLOSED";
export type ReceiptKind = "RECEIPT" | "RETURN";
export type ReceiptStatus = "DRAFT" | "POSTED";
export type MessageChannel = "WHATSAPP" | "EMAIL";

export type Suggestion = {
  id: string;
  number: string;
  productId: string;
  siteId: string | null;
  qty: string;
  reason: SuggestionReason;
  status: SuggestionStatus;
  poId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type StockPolicy = {
  id: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  siteId: string;
  minQty: string;
  safetyQty: string;
  version: number;
  updatedAt: string;
};

export type PoLine = {
  id: string;
  poId: string;
  lineNo: number;
  productId: string;
  qtyOrdered: string;
  qtyReceived: string;
  unitPrice: string;
  lineTotal: string;
  moq: string | null;
  pack: string | null;
  status: PoLineStatus;
  version: number;
};

export type PoMessage = {
  id: string;
  poId: string;
  channel: MessageChannel;
  toAddress: string;
  templateKey: string;
  bodyPreview: string | null;
  status: string;
  createdAt: string;
};

export type Po = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string | null;
  siteId: string | null;
  warehouseId: string | null;
  status: PoStatus;
  expectedDate: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  submittedAt: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines?: PoLine[];
  receipts?: Receipt[];
  messages?: PoMessage[];
};

export type ReceiptLine = {
  id: string;
  receiptId: string;
  lineNo: number;
  poLineId: string;
  productId: string;
  qty: string;
  lotCode: string | null;
  dlc: string | null;
  unitPrice: string;
};

export type Receipt = {
  id: string;
  number: string;
  poId: string;
  warehouseId: string;
  kind: ReceiptKind;
  status: ReceiptStatus;
  qcStatus: string | null;
  apBillId: string | null;
  postedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines?: ReceiptLine[];
};

export type SupplierOption = { id: string; name: string };

type ApiFail = { ok: false; status: number; message: string };
type ApiOk<T> = { ok: true; data: T };
type ApiResult<T> = ApiOk<T> | ApiFail;

const BASE = "/api/v1/procurement";

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      code?: string;
    };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.code) return body.code;
  } catch {
    /* ignore */
  }
  return res.statusText || "Erreur réseau";
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: init?.method ?? "GET",
    credentials: "include",
    ...(init?.body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(init.body),
        }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as T };
}

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value?.trim()) search.set(key, value.trim());
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// ------------------------------------------------------------------ policies

export async function fetchPolicies(): Promise<ApiResult<{ items: StockPolicy[] }>> {
  return call<{ items: StockPolicy[] }>("/policies");
}

export async function upsertPolicy(body: {
  productId: string;
  siteId: string;
  minQty: number;
  safetyQty?: number;
}): Promise<ApiResult<StockPolicy>> {
  return call<StockPolicy>("/policies", { method: "PUT", body });
}

export async function removePolicy(id: string): Promise<ApiResult<{ removed: true }>> {
  return call<{ removed: true }>(`/policies/${id}`, { method: "DELETE" });
}

// --------------------------------------------------------------- suggestions

export async function fetchSuggestions(
  status?: string,
): Promise<ApiResult<{ items: Suggestion[]; nextCursor: string | null }>> {
  return call(`/suggestions${qs({ status })}`);
}

export async function createSuggestion(body: {
  productId: string;
  qty: number;
  reason: SuggestionReason;
  siteId?: string;
}): Promise<ApiResult<Suggestion>> {
  return call<Suggestion>("/suggestions", { method: "POST", body });
}

export async function generateSuggestions(): Promise<
  ApiResult<{ scanned: number; created: number }>
> {
  return call("/suggestions/generate", { method: "POST" });
}

export async function approveSuggestion(
  id: string,
  version: number,
): Promise<ApiResult<Suggestion>> {
  return call<Suggestion>(`/suggestions/${id}/approve`, {
    method: "POST",
    body: { version },
  });
}

export async function rejectSuggestion(
  id: string,
  version: number,
): Promise<ApiResult<Suggestion>> {
  return call<Suggestion>(`/suggestions/${id}/reject`, {
    method: "POST",
    body: { version },
  });
}

export async function convertSuggestion(
  id: string,
  body: {
    version: number;
    supplierId: string;
    unitPrice: number;
    qty?: number;
    warehouseId?: string;
    siteId?: string;
    expectedDate?: string;
  },
): Promise<ApiResult<Po>> {
  return call<Po>(`/suggestions/${id}/convert`, { method: "POST", body });
}

// ------------------------------------------------------------------------ PO

export async function fetchPos(
  opts?: { status?: string; q?: string },
): Promise<ApiResult<{ items: Po[]; nextCursor: string | null }>> {
  return call(`/pos${qs(opts ?? {})}`);
}

export async function fetchPo(id: string): Promise<ApiResult<Po>> {
  return call<Po>(`/pos/${id}`);
}

export async function createPo(body: {
  supplierId: string;
  siteId?: string;
  warehouseId?: string;
  expectedDate?: string;
  currency?: string;
  notes?: string;
  lines: Array<{
    productId: string;
    qtyOrdered: number;
    unitPrice: number;
    moq?: number;
    pack?: number;
  }>;
}): Promise<ApiResult<Po>> {
  return call<Po>("/pos", { method: "POST", body });
}

export async function transitionPo(
  id: string,
  action: "submit" | "approve" | "confirm" | "cancel",
  version: number,
): Promise<ApiResult<Po>> {
  return call<Po>(`/pos/${id}/${action}`, {
    method: "POST",
    body: { version },
  });
}

export async function sendPo(
  id: string,
  body: { version: number; channel: MessageChannel; toAddress: string; templateKey?: string },
): Promise<ApiResult<Po>> {
  return call<Po>(`/pos/${id}/send`, { method: "POST", body });
}

// ------------------------------------------------------------------ receipts

export async function fetchReceipts(
  poId?: string,
): Promise<ApiResult<{ items: Receipt[]; nextCursor: string | null }>> {
  return call(`/receipts${qs({ poId })}`);
}

export async function fetchReceipt(id: string): Promise<ApiResult<Receipt>> {
  return call<Receipt>(`/receipts/${id}`);
}

export async function createReceipt(
  poId: string,
  body: {
    version: number;
    warehouseId: string;
    kind?: ReceiptKind;
    lines: Array<{
      poLineId: string;
      qty: number;
      lotCode?: string;
      dlc?: string;
      unitPrice?: number;
    }>;
  },
): Promise<ApiResult<Receipt>> {
  return call<Receipt>(`/pos/${poId}/receipts`, { method: "POST", body });
}

export async function updateReceipt(
  id: string,
  body: { version: number; qcStatus?: string },
): Promise<ApiResult<Receipt>> {
  return call<Receipt>(`/receipts/${id}`, { method: "PATCH", body });
}

export async function postReceipt(
  id: string,
  version: number,
): Promise<ApiResult<Receipt>> {
  return call<Receipt>(`/receipts/${id}/post`, {
    method: "POST",
    body: { version },
  });
}

/** Orderable suppliers for PO pickers — server re-checks ACTIVE status. */
export async function fetchSupplierOptions(): Promise<
  ApiResult<{ items: SupplierOption[] }>
> {
  const res = await fetch("/api/v1/suppliers", { credentials: "include" });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  const data = (await res.json()) as {
    items: Array<{ id: string; name: string; status?: string }>;
  };
  return {
    ok: true,
    data: {
      items: (data.items ?? [])
        .filter((s) => !s.status || s.status === "ACTIVE")
        .map((s) => ({ id: s.id, name: s.name })),
    },
  };
}

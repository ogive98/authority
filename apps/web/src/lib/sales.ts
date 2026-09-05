export type SalesOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export type SalesOrderLine = {
  id: string;
  lineNo: number;
  productId: string;
  productSku: string | null;
  productName: string | null;
  qty: string;
  unitPrice: string;
  discountPct: string;
  lineTotal: string;
};

export type SalesOrder = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  status: SalesOrderStatus;
  requestedDate: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  version: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesOrderLine[];
};

export type SalesOrderListResponse = {
  items: SalesOrder[];
  nextCursor: string | null;
};

export type SalesLineInput = {
  productId: string;
  qty: number;
  unitPrice: number;
  discountPct?: number;
};

export type CreateSalesOrderBody = {
  customerId: string;
  warehouseId: string;
  requestedDate?: string;
  notes?: string;
  lines: SalesLineInput[];
};

export const STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Brouillon",
  CONFIRMED: "Confirmée",
  CANCELLED: "Annulée",
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

export async function fetchSalesOrders(q?: string): Promise<
  { ok: true; data: SalesOrderListResponse } | ApiFail
> {
  try {
    const url = q?.trim()
      ? `/api/v1/sales/orders?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/sales/orders";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesOrderListResponse };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchSalesOrder(
  id: string,
): Promise<{ ok: true; data: SalesOrder } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/orders/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesOrder };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createSalesOrder(
  body: CreateSalesOrderBody,
): Promise<{ ok: true; data: SalesOrder } | ApiFail> {
  try {
    const res = await fetch("/api/v1/sales/orders", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesOrder };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function confirmSalesOrder(
  id: string,
): Promise<{ ok: true; data: SalesOrder } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/orders/${id}/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesOrder };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelSalesOrder(
  id: string,
): Promise<{ ok: true; data: SalesOrder } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/orders/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesOrder };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type CustomerOption = {
  id: string;
  code: string;
  legalName: string;
  status: string;
};

export async function fetchCustomerOptions(): Promise<
  { ok: true; items: CustomerOption[] } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/customers", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const data = (await res.json()) as {
      items: Array<{
        id: string;
        code: string;
        legalName: string;
        status: string;
      }>;
    };
    return {
      ok: true,
      items: data.items.filter((c) => c.status === "ACTIVE"),
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

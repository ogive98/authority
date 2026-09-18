export type ReturnsRmaStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type ReturnsDisposition = "RESTOCK" | "SCRAP";

export type ReturnsRmaLine = {
  id: string;
  lineNo: number;
  orderLineId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  qty: string;
  disposition: ReturnsDisposition;
  unitPrice: string;
};

export type ReturnsRma = {
  id: string;
  companyId: string;
  number: string;
  shipmentId: string;
  shipmentNumber: string | null;
  orderId: string;
  orderNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  creditNoteId: string | null;
  creditNoteNumber: string | null;
  status: ReturnsRmaStatus;
  notes: string | null;
  version: number;
  postedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: ReturnsRmaLine[];
};

export type ReturnsRmaListResponse = {
  items: ReturnsRma[];
  nextCursor: string | null;
};

export type CreateReturnsRmaBody = {
  shipmentId: string;
  notes?: string;
  lines: Array<{
    orderLineId: string;
    qty: number;
    disposition: ReturnsDisposition;
  }>;
};

export const RMA_STATUS_LABELS: Record<ReturnsRmaStatus, string> = {
  DRAFT: "Brouillon",
  POSTED: "Posté",
  CANCELLED: "Annulé",
};

export const DISPOSITION_LABELS: Record<ReturnsDisposition, string> = {
  RESTOCK: "Restock",
  SCRAP: "Rebut",
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

export async function fetchReturnsRmas(opts?: {
  q?: string;
  status?: ReturnsRmaStatus | "";
  shipmentId?: string;
}): Promise<{ ok: true; data: ReturnsRmaListResponse } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    if (opts?.shipmentId) params.set("shipmentId", opts.shipmentId);
    const qs = params.toString();
    const res = await fetch(
      qs ? `/api/v1/sales/returns/rmas?${qs}` : "/api/v1/sales/returns/rmas",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRmaListResponse };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchReturnsRma(
  id: string,
): Promise<{ ok: true; data: ReturnsRma } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/returns/rmas/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRma };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createReturnsRma(
  body: CreateReturnsRmaBody,
): Promise<{ ok: true; data: ReturnsRma } | ApiFail> {
  try {
    const res = await fetch("/api/v1/sales/returns/rmas", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRma };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function postReturnsRma(
  id: string,
): Promise<{ ok: true; data: ReturnsRma } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/returns/rmas/${encodeURIComponent(id)}/post`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRma };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelReturnsRma(
  id: string,
): Promise<{ ok: true; data: ReturnsRma } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/returns/rmas/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRma };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createRmaCreditNote(
  id: string,
): Promise<{ ok: true; data: ReturnsRma } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/returns/rmas/${encodeURIComponent(id)}/create-credit-note`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ReturnsRma };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

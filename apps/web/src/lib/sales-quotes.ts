import type { SalesLineInput, SalesOrder } from "./sales";

export type SalesQuoteStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "CANCELLED"
  | "EXPIRED";

export type SalesQuoteLine = {
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

export type SalesQuote = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string | null;
  warehouseCode: string | null;
  status: SalesQuoteStatus;
  validUntil: string | null;
  currency: string;
  notes: string | null;
  amountTotal: string;
  version: number;
  convertedOrderId: string | null;
  pdfDocumentId?: string | null;
  acceptedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SalesQuoteLine[];
};

export type SalesQuoteListResponse = {
  items: SalesQuote[];
  nextCursor: string | null;
};

export type CreateSalesQuoteBody = {
  customerId: string;
  warehouseId?: string;
  validUntil?: string;
  notes?: string;
  lines: SalesLineInput[];
};

export type UpdateSalesQuoteBody = {
  version: number;
  customerId?: string;
  warehouseId?: string | null;
  validUntil?: string | null;
  notes?: string | null;
  lines?: SalesLineInput[];
};

export type ConvertQuoteResult = {
  quote: SalesQuote;
  order: SalesOrder;
};

export const QUOTE_STATUS_LABELS: Record<SalesQuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
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

export async function fetchSalesQuotes(opts?: {
  q?: string;
  status?: SalesQuoteStatus | "";
  customerId?: string;
}): Promise<{ ok: true; data: SalesQuoteListResponse } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    if (opts?.customerId) params.set("customerId", opts.customerId);
    const qs = params.toString();
    const res = await fetch(
      qs ? `/api/v1/sales/quotes?${qs}` : "/api/v1/sales/quotes",
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuoteListResponse };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchSalesQuote(
  id: string,
): Promise<{ ok: true; data: SalesQuote } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/quotes/${encodeURIComponent(id)}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createSalesQuote(
  body: CreateSalesQuoteBody,
): Promise<{ ok: true; data: SalesQuote } | ApiFail> {
  try {
    const res = await fetch("/api/v1/sales/quotes", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function updateSalesQuote(
  id: string,
  body: UpdateSalesQuoteBody,
): Promise<{ ok: true; data: SalesQuote } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/sales/quotes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function sendSalesQuote(
  id: string,
): Promise<{ ok: true; data: SalesQuote } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/quotes/${encodeURIComponent(id)}/send`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelSalesQuote(
  id: string,
): Promise<{ ok: true; data: SalesQuote } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/quotes/${encodeURIComponent(id)}/cancel`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as SalesQuote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function convertSalesQuote(
  id: string,
): Promise<{ ok: true; data: ConvertQuoteResult } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/quotes/${encodeURIComponent(id)}/convert`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as ConvertQuoteResult };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

/** D318 — stream PDF (DRAFT/SENT/ACCEPTED); triggers persist on server. */
export async function fetchSalesQuotePdfBlob(
  id: string,
): Promise<{ ok: true; blob: Blob; filename: string } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/sales/quotes/${encodeURIComponent(id)}/pdf`,
      {
        credentials: "include",
      },
    );
    if (!res.ok) return parseFail(res);
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") ?? "";
    const match = /filename="([^"]+)"/.exec(cd);
    const filename = match?.[1] ?? `devis-${id.slice(0, 8)}.pdf`;
    return { ok: true, blob, filename };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function downloadSalesQuotePdf(
  id: string,
): Promise<{ ok: true } | ApiFail> {
  const res = await fetchSalesQuotePdfBlob(id);
  if (!res.ok) return res;
  const url = URL.createObjectURL(res.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = res.filename;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

/** Open PDF in a print dialog (Chromium print preview). */
export async function printSalesQuotePdf(
  id: string,
): Promise<{ ok: true } | ApiFail> {
  const res = await fetchSalesQuotePdfBlob(id);
  if (!res.ok) return res;
  const url = URL.createObjectURL(res.blob);
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (!w) {
    URL.revokeObjectURL(url);
    return {
      ok: false,
      status: 0,
      message: "Pop-up bloquée — autorisez les fenêtres pour imprimer.",
    };
  }
  const revoke = () => URL.revokeObjectURL(url);
  w.addEventListener("load", () => {
    try {
      w.focus();
      w.print();
    } finally {
      setTimeout(revoke, 60_000);
    }
  });
  // Some browsers never fire load on blob PDF — fallback timer
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 1200);
  return { ok: true };
}

/** D318b — persist PDF as CUSTOMER_PORTAL for /portal/documents. */
export async function publishSalesQuotePortal(
  id: string,
): Promise<
  | { ok: true; data: { documentId: string; number: string; customerId: string } }
  | ApiFail
> {
  try {
    const res = await fetch(
      `/api/v1/sales/quotes/${encodeURIComponent(id)}/publish-portal`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        documentId: string;
        number: string;
        customerId: string;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

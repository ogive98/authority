export type OpenItemStatus = "OPEN" | "PARTIAL" | "CLOSED";

export type FinOpenItem = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  side: "AR" | "AP";
  status: OpenItemStatus;
  salesOrderId: string | null;
  currency: string;
  amountTotal: string;
  amountOpen: string;
  dueDate: string | null;
  label: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allocations: {
    id: string;
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type CreditSnapshot = {
  customerId: string;
  creditLimit: string | null;
  outstandingBalance: string;
  currency: string;
};

export const OPEN_ITEM_STATUS_LABELS: Record<OpenItemStatus, string> = {
  OPEN: "Ouvert",
  PARTIAL: "Partiel",
  CLOSED: "Soldé",
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

export async function fetchOpenItems(opts?: {
  q?: string;
  status?: OpenItemStatus | "";
  customerId?: string;
}): Promise<
  | { ok: true; data: { items: FinOpenItem[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    if (opts?.customerId) params.set("customerId", opts.customerId);
    const qs = params.toString();
    const res = await fetch(`/api/v1/finance/open-items${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinOpenItem[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createOpenItem(body: {
  customerId: string;
  amountTotal: number;
  dueDate?: string;
  label?: string;
  notes?: string;
  currency?: string;
}): Promise<{ ok: true; data: FinOpenItem } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/open-items", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinOpenItem };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function allocateOpenItem(
  id: string,
  body: { amount: number; paidAt?: string; note?: string },
): Promise<{ ok: true; data: FinOpenItem } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/open-items/${id}/allocate`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinOpenItem };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export function openItemBadgeTone(
  status: OpenItemStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "CLOSED") return "success";
  if (status === "PARTIAL") return "warning";
  if (status === "OPEN") return "accent";
  return "neutral";
}

export type OpenItemStatus = "OPEN" | "PARTIAL" | "CLOSED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHEQUE"
  | "BILL_OF_EXCHANGE"
  | "OTHER";
export type PaymentStatus = "DRAFT" | "POSTED" | "REVERSED";
export type AllocationPolicy =
  | "OLDEST_FIRST"
  | "NEWEST_FIRST"
  | "PROPORTIONAL"
  | "COMPLETION_FIRST"
  | "LARGEST_FIRST"
  | "OVERDUE_FIRST"
  | "MANUAL";
export type InstrumentType = "CHEQUE" | "BILL_OF_EXCHANGE";
export type InstrumentStatus =
  | "RECEIVED"
  | "DEPOSITED"
  | "PRESENTED"
  | "CLEARED"
  | "REJECTED"
  | "CANCELLED";

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
  invoiceId: string | null;
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

export type FinInvoice = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  status: InvoiceStatus;
  salesOrderId: string | null;
  shipmentId: string | null;
  currency: string;
  amountHt: string;
  amountTax: string;
  amountFodec?: string;
  amountTimbre?: string;
  amountTotal: string;
  dueDate: string | null;
  issuedAt: string | null;
  label: string | null;
  notes: string | null;
  openItemId: string | null;
  expertiseApplied?: { fodec: boolean; timbre: boolean };
  lines: {
    id: string;
    lineNo: number;
    description: string;
    qty: string;
    unitPriceHt: string;
    taxCodeId: string;
    taxCode: string | null;
    amountHt: string;
    amountTax: string;
    amountTtc: string;
  }[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FinPayment = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  amount: string;
  amountUnallocated: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDate: string;
  accountingDate: string;
  reference: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  instruments: FinInstrument[];
  allocations: {
    id: string;
    openItemId: string;
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type FinInstrument = {
  id: string;
  paymentId: string;
  type: InstrumentType;
  status: InstrumentStatus;
  number: string;
  bankName: string | null;
  holder: string | null;
  amount: string;
  issueDate: string | null;
  receiveDate: string | null;
  dueDate: string | null;
  depositDate: string | null;
  clearedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
};

export type AllocationPlan = {
  policy: AllocationPolicy;
  customerId: string;
  paymentAmount: number;
  lines: {
    openItemId: string;
    openItemNumber: string;
    amount: number;
    amountOpenBefore: number;
  }[];
  remainder: number;
};

export type CreditSnapshot = {
  customerId: string;
  creditLimit: string | null;
  outstandingBalance: string;
  currency: string;
};

export type ArAgingBucket = {
  key: "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";
  label: string;
  amountOpen: string;
  count: number;
};

export type ArAging = {
  customerId: string;
  asOf: string;
  currency: string;
  totalOpen: string;
  overdueTotal: string;
  buckets: ArAgingBucket[];
};

export type CustomerFinancialOverview = {
  customerId: string;
  credit: CreditSnapshot;
  aging: ArAging;
  openCount: number;
  overdueCount: number;
  availableCredit: string | null;
  creditPressure?: {
    level: "ok" | "warn" | "breach" | null;
    ratio: number | null;
    warnRatio: number;
  };
  currency: string;
};

export const OPEN_ITEM_STATUS_LABELS: Record<OpenItemStatus, string> = {
  OPEN: "Ouvert",
  PARTIAL: "Partiel",
  CLOSED: "Soldé",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  CANCELLED: "Annulée",
};

export const POLICY_LABELS: Record<AllocationPolicy, string> = {
  OLDEST_FIRST: "A — Plus anciennes",
  NEWEST_FIRST: "B — Plus récentes",
  PROPORTIONAL: "C — Proportionnel",
  COMPLETION_FIRST: "D — Clôture d’abord",
  LARGEST_FIRST: "E — Plus grandes",
  OVERDUE_FIRST: "F — Échues d’abord",
  MANUAL: "G — Manuel",
};

export const INSTRUMENT_STATUS_LABELS: Record<InstrumentStatus, string> = {
  RECEIVED: "Reçu",
  DEPOSITED: "Déposé",
  PRESENTED: "Présenté",
  CLEARED: "Encaissé",
  REJECTED: "Rejeté",
  CANCELLED: "Annulé",
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
  overdue?: boolean;
}): Promise<
  | { ok: true; data: { items: FinOpenItem[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    if (opts?.customerId) params.set("customerId", opts.customerId);
    if (opts?.overdue) params.set("overdue", "1");
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

export async function fetchCreditSnapshot(
  customerId: string,
): Promise<{ ok: true; data: CreditSnapshot } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/credit/${encodeURIComponent(customerId)}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as CreditSnapshot };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCustomerFinancialOverview(
  customerId: string,
): Promise<{ ok: true; data: CustomerFinancialOverview } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/customers/${encodeURIComponent(customerId)}/overview`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as CustomerFinancialOverview,
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

export async function fetchInvoices(opts?: {
  q?: string;
  status?: InvoiceStatus | "";
}): Promise<
  | { ok: true; data: { items: FinInvoice[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    const res = await fetch(`/api/v1/finance/invoices${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinInvoice[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createInvoice(body: {
  customerId: string;
  amountTotal?: number;
  lines?: {
    description: string;
    qty: number;
    unitPriceHt: number;
    taxCodeId: string;
  }[];
  dueDate?: string;
  label?: string;
  notes?: string;
  currency?: string;
  issue?: boolean;
}): Promise<{ ok: true; data: FinInvoice } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/invoices", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInvoice };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function issueInvoice(
  id: string,
): Promise<{ ok: true; data: FinInvoice } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/invoices/${id}/issue`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInvoice };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelInvoice(
  id: string,
): Promise<{ ok: true; data: FinInvoice } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/invoices/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInvoice };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchPayments(opts?: {
  q?: string;
}): Promise<
  | { ok: true; data: { items: FinPayment[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    const qs = params.toString();
    const res = await fetch(`/api/v1/finance/payments${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinPayment[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createPayment(body: {
  customerId: string;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  reference?: string;
  notes?: string;
  currency?: string;
  instrument?: {
    type: InstrumentType;
    number: string;
    amount: number;
    bankName?: string;
    holder?: string;
    dueDate?: string;
  };
}): Promise<{ ok: true; data: FinPayment } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/payments", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPayment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function simulateAllocation(
  paymentId: string,
  body: {
    policy: AllocationPolicy;
    lines?: { openItemId: string; amount: number }[];
  },
): Promise<{ ok: true; data: AllocationPlan } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/payments/${paymentId}/allocate/simulate`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AllocationPlan };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function confirmAllocation(
  paymentId: string,
  body: {
    policy: AllocationPolicy;
    lines?: { openItemId: string; amount: number }[];
    note?: string;
  },
): Promise<{ ok: true; data: FinPayment } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/payments/${paymentId}/allocate/confirm`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPayment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchInstruments(opts?: {
  status?: InstrumentStatus | "";
}): Promise<{ ok: true; data: { items: FinInstrument[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/finance/instruments${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinInstrument[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function transitionInstrument(
  id: string,
  body: { status: InstrumentStatus; rejectReason?: string },
): Promise<{ ok: true; data: FinInstrument } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/instruments/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInstrument };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type PromiseStatus = "OPEN" | "KEPT" | "BROKEN" | "CANCELLED";

export type FinPromise = {
  id: string;
  companyId: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  openItemId: string;
  openItemNumber: string | null;
  amount: string;
  currency: string;
  promisedDate: string;
  status: PromiseStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export const PROMISE_STATUS_LABELS: Record<PromiseStatus, string> = {
  OPEN: "Ouverte",
  KEPT: "Tenue",
  BROKEN: "Rompue",
  CANCELLED: "Annulée",
};

export async function fetchPromises(opts?: {
  q?: string;
  status?: PromiseStatus | "";
  customerId?: string;
  openItemId?: string;
  broken?: boolean;
}): Promise<{ ok: true; data: { items: FinPromise[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.customerId) params.set("customerId", opts.customerId);
    if (opts?.openItemId) params.set("openItemId", opts.openItemId);
    if (opts?.broken) params.set("broken", "1");
    const qs = params.toString();
    const res = await fetch(`/api/v1/finance/promises${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinPromise[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createPromise(body: {
  openItemId: string;
  amount: number;
  promisedDate: string;
  notes?: string;
}): Promise<{ ok: true; data: FinPromise } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/promises", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPromise };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelPromise(
  id: string,
): Promise<{ ok: true; data: FinPromise } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/promises/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPromise };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export function promiseBadgeTone(
  status: PromiseStatus,
): "success" | "warning" | "accent" | "neutral" | "danger" {
  if (status === "KEPT") return "success";
  if (status === "OPEN") return "accent";
  if (status === "BROKEN") return "danger";
  return "neutral";
}

export function openItemBadgeTone(
  status: OpenItemStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "CLOSED") return "success";
  if (status === "PARTIAL") return "warning";
  if (status === "OPEN") return "accent";
  return "neutral";
}

export function isOpenItemOverdue(
  item: Pick<FinOpenItem, "dueDate" | "status">,
  today = new Date(),
): boolean {
  if (!item.dueDate) return false;
  if (item.status === "CLOSED") return false;
  const due = new Date(`${item.dueDate}T00:00:00.000Z`);
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  return due.getTime() < start.getTime();
}

export function invoiceBadgeTone(
  status: InvoiceStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "ISSUED") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

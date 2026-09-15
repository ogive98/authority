export type OpenItemStatus = "OPEN" | "PARTIAL" | "CLOSED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type CreditNoteStatus = "DRAFT" | "ISSUED" | "CANCELLED";
export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHEQUE"
  | "BILL_OF_EXCHANGE"
  | "OTHER";
export type PaymentStatus = "DRAFT" | "POSTED" | "REVERSED";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  DRAFT: "Brouillon",
  POSTED: "Posté",
  REVERSED: "Contrepassé",
};

export const PAYMENT_STATUS_FILTERS: {
  id: "" | PaymentStatus;
  label: string;
}[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "POSTED", label: "Posté" },
  { id: "REVERSED", label: "Contrepassé" },
];

export function paymentBadgeTone(
  status: PaymentStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "POSTED") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}
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
  fulfillmentDoc?: "DELIVERY_NOTE" | "INVOICE";
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
    lineType?: "PRODUCT" | "TAX";
    description: string;
    qty: string;
    unitPriceHt: string;
    taxCodeId: string;
    taxCode: string | null;
    productId?: string | null;
    amountHt: string;
    amountTax: string;
    amountTtc: string;
  }[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FinCreditNote = {
  id: string;
  companyId: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  status: CreditNoteStatus;
  currency: string;
  amountHt: string;
  amountTax: string;
  amountFodec?: string;
  amountTimbre?: string;
  amountTotal: string;
  amountAppliedToAr: string;
  amountUnapplied: string;
  reason: string | null;
  notes: string | null;
  issuedAt: string | null;
  expertiseApplied?: { fodec: boolean; timbre: boolean };
  lines: {
    id: string;
    lineNo: number;
    lineType?: "PRODUCT" | "TAX";
    description: string;
    qty: string;
    unitPriceHt: string;
    taxCodeId: string;
    taxCode: string | null;
    productId?: string | null;
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

export const CREDIT_NOTE_STATUS_LABELS: Record<CreditNoteStatus, string> = {
  DRAFT: "Brouillon",
  ISSUED: "Émis",
  CANCELLED: "Annulé",
};

export const CREDIT_NOTE_STATUS_FILTERS: {
  id: "" | CreditNoteStatus;
  label: string;
}[] = [
  { id: "", label: "Tout" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "ISSUED", label: "Émis" },
  { id: "CANCELLED", label: "Annulé" },
];

export type ApBillStatus = "DRAFT" | "POSTED" | "CANCELLED";

export const AP_BILL_STATUS_LABELS: Record<ApBillStatus, string> = {
  DRAFT: "Brouillon",
  POSTED: "Postée",
  CANCELLED: "Annulée",
};

export const AP_BILL_STATUS_FILTERS: { id: "" | ApBillStatus; label: string }[] =
  [
    { id: "", label: "Tout" },
    { id: "DRAFT", label: "Brouillon" },
    { id: "POSTED", label: "Postée" },
    { id: "CANCELLED", label: "Annulée" },
  ];

export type FinApBillPayment = {
  id: string;
  number: string;
  amount: string;
  currency: string;
  method: string;
  paymentDate: string;
  matched: boolean;
};

export type FinApBill = {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  supplierId?: string | null;
  status: ApBillStatus;
  billDate: string;
  dueDate: string | null;
  amountTotal: string;
  currency: string;
  label: string | null;
  reference: string | null;
  notes: string | null;
  version: number;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: FinApBillPayment[];
  amountPaid?: string;
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

export const INSTRUMENT_STATUS_FILTERS: {
  id: "" | InstrumentStatus;
  label: string;
}[] = [
  { id: "", label: "Tout" },
  { id: "RECEIVED", label: "Reçu" },
  { id: "DEPOSITED", label: "Déposé" },
  { id: "PRESENTED", label: "Présenté" },
  { id: "CLEARED", label: "Encaissé" },
  { id: "REJECTED", label: "Rejeté" },
  { id: "CANCELLED", label: "Annulé" },
];

export function instrumentBadgeTone(
  status: InstrumentStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "CLEARED") return "success";
  if (status === "REJECTED" || status === "CANCELLED") return "warning";
  return "accent";
}

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

export async function fetchInvoice(
  id: string,
): Promise<{ ok: true; data: FinInvoice } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/invoices/${encodeURIComponent(id)}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInvoice };
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
  salesOrderId?: string;
  fulfillmentDoc?: "DELIVERY_NOTE" | "INVOICE";
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

export async function fetchCreditNotes(opts?: {
  q?: string;
  status?: CreditNoteStatus | "";
  invoiceId?: string;
}): Promise<
  | { ok: true; data: { items: FinCreditNote[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    if (opts?.invoiceId) params.set("invoiceId", opts.invoiceId);
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/finance/credit-notes${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinCreditNote[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCreditNote(
  id: string,
): Promise<{ ok: true; data: FinCreditNote } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/credit-notes/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinCreditNote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createCreditNote(body: {
  sourceInvoiceId: string;
  lines?: {
    description: string;
    qty: number;
    unitPriceHt: number;
    taxCodeId: string;
  }[];
  copyFull?: boolean;
  reason?: string;
  notes?: string;
  currency?: string;
  issue?: boolean;
}): Promise<{ ok: true; data: FinCreditNote } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/credit-notes", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinCreditNote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function issueCreditNote(
  id: string,
): Promise<{ ok: true; data: FinCreditNote } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/credit-notes/${id}/issue`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinCreditNote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelCreditNote(
  id: string,
): Promise<{ ok: true; data: FinCreditNote } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/credit-notes/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinCreditNote };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchPayments(opts?: {
  q?: string;
  status?: string;
}): Promise<
  | { ok: true; data: { items: FinPayment[]; nextCursor: string | null } }
  | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
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

export async function fetchPayment(
  id: string,
): Promise<{ ok: true; data: FinPayment } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/payments/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPayment };
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

export async function reversePayment(
  paymentId: string,
): Promise<{ ok: true; data: FinPayment } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/payments/${paymentId}/reverse`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
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

export async function fetchInstrument(
  id: string,
): Promise<{ ok: true; data: FinInstrument } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/instruments/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinInstrument };
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

export const PROMISE_STATUS_FILTERS: {
  id: "" | PromiseStatus;
  label: string;
}[] = [
  { id: "", label: "Tout" },
  { id: "OPEN", label: "Ouvertes" },
  { id: "KEPT", label: "Tenues" },
  { id: "BROKEN", label: "Rompues" },
  { id: "CANCELLED", label: "Annulées" },
];

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

export async function fetchPromise(
  id: string,
): Promise<{ ok: true; data: FinPromise } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/promises/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPromise };
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

/** D243 — portal payment declarations (ADV review; no FinPayment auto-create). */
export type PaymentDeclarationStatus =
  | "SUBMITTED"
  | "ACKNOWLEDGED"
  | "REJECTED"
  | "CANCELLED";

export type FinPaymentDeclaration = {
  id: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  amount: string;
  currency: string;
  method: PaymentMethod;
  paymentDate: string;
  reference: string | null;
  notes: string | null;
  openItemId: string | null;
  status: PaymentDeclarationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdByUserId: string;
};

export const PAYMENT_DECLARATION_STATUS_LABELS: Record<
  PaymentDeclarationStatus,
  string
> = {
  SUBMITTED: "Soumise",
  ACKNOWLEDGED: "Prise en compte",
  REJECTED: "Refusée",
  CANCELLED: "Annulée",
};

export const PAYMENT_DECLARATION_STATUS_FILTERS: {
  id: "" | PaymentDeclarationStatus;
  label: string;
}[] = [
  { id: "", label: "Tout" },
  { id: "SUBMITTED", label: "Soumises" },
  { id: "ACKNOWLEDGED", label: "Prises en compte" },
  { id: "REJECTED", label: "Refusées" },
  { id: "CANCELLED", label: "Annulées" },
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement",
  CARD: "Carte",
  CHEQUE: "Chèque",
  BILL_OF_EXCHANGE: "Traite",
  OTHER: "Autre",
};

export function paymentDeclarationBadgeTone(
  status: PaymentDeclarationStatus,
): "success" | "warning" | "accent" | "neutral" | "danger" {
  if (status === "ACKNOWLEDGED") return "success";
  if (status === "SUBMITTED") return "accent";
  if (status === "REJECTED") return "danger";
  return "neutral";
}

export async function fetchPaymentDeclarations(opts?: {
  q?: string;
  status?: PaymentDeclarationStatus | "";
  customerId?: string;
}): Promise<
  { ok: true; data: { items: FinPaymentDeclaration[]; nextCursor: string | null } } | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.customerId) params.set("customerId", opts.customerId);
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/finance/payment-declarations${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinPaymentDeclaration[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchPaymentDeclaration(
  id: string,
): Promise<{ ok: true; data: FinPaymentDeclaration } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/payment-declarations/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinPaymentDeclaration };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function acknowledgePaymentDeclaration(
  id: string,
  body: { version: number; reviewNote?: string },
): Promise<{ ok: true; data: FinPaymentDeclaration } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/payment-declarations/${id}/acknowledge`,
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
    return { ok: true, data: (await res.json()) as FinPaymentDeclaration };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function rejectPaymentDeclaration(
  id: string,
  body: { version: number; reviewNote?: string },
): Promise<{ ok: true; data: FinPaymentDeclaration } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/payment-declarations/${id}/reject`,
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
    return { ok: true, data: (await res.json()) as FinPaymentDeclaration };
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

export function creditNoteBadgeTone(
  status: CreditNoteStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "ISSUED") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

export function apBillBadgeTone(
  status: ApBillStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "POSTED") return "success";
  if (status === "DRAFT") return "warning";
  return "neutral";
}

/** D189 banking soft recon */
export type BankLineStatus = "UNMATCHED" | "MATCHED" | "IGNORED";

export type FinBankAccount = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  bankName: string | null;
  rib: string | null;
  iban: string | null;
  glAccountCode: string | null;
  currency: string;
  active: boolean;
  isDefault: boolean;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
};

export type BankTreasury = {
  currency: "TND";
  accountCount: number;
  activeAccountCount: number;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
  balancesVisible: boolean;
  glBankCode: string | null;
  glBankBalance: string | null;
  balanceHideReason: string | null;
  accounts: {
    id: string;
    code: string;
    label: string;
    active: boolean;
    unmatchedCount: number;
    matchedCount: number;
    ignoredCount: number;
  }[];
};

export type BankCsvPreview = {
  delimiter: "," | ";";
  lineCount: number;
  errorCount: number;
  lines: {
    row: number;
    lineDate: string;
    amount: number;
    reference?: string;
    counterparty?: string;
    memo?: string;
  }[];
  errors: { row: number; message: string }[];
};

export type BankOfxPreview = {
  dialect: "OFX1";
  lineCount: number;
  errorCount: number;
  duplicateFitIdCount: number;
  lines: {
    row: number;
    lineDate: string;
    amount: number;
    fitId: string;
    reference?: string;
    counterparty?: string;
    memo?: string;
    duplicate?: boolean;
  }[];
  errors: { row: number; message: string }[];
};

export type FinBankMatch = {
  id: string;
  paymentId: string | null;
  instrumentId: string | null;
  apPaymentId: string | null;
  note: string | null;
  matchedAt: string;
  paymentNumber: string | null;
  instrumentNumber: string | null;
  apPaymentNumber: string | null;
};

export type FinBankStatementLine = {
  id: string;
  companyId: string;
  bankAccountId: string;
  lineDate: string;
  amount: string;
  currency: string;
  reference: string | null;
  counterparty: string | null;
  memo: string | null;
  fitId: string | null;
  feePostedAt: string | null;
  status: BankLineStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  match: FinBankMatch | null;
};

export type BankMatchCandidates = {
  line: FinBankStatementLine;
  side: "AR" | "AP" | "NONE";
  payments: {
    id: string;
    number: string;
    amount: string;
    method: string;
    paymentDate: string;
    customerName: string | null;
    reference: string | null;
  }[];
  instruments: {
    id: string;
    number: string;
    type: string;
    status: string;
    amount: string;
    paymentId: string;
    paymentNumber: string;
    bankName: string | null;
  }[];
  apPayments: {
    id: string;
    number: string;
    amount: string;
    method: string;
    paymentDate: string;
    vendorName: string;
    reference: string | null;
  }[];
};

export type FinApPayment = {
  id: string;
  companyId: string;
  number: string;
  vendorName: string;
  amount: string;
  amountRas?: string;
  rasRateBps?: number | null;
  rasApplied?: boolean;
  amountGross?: string;
  currency: string;
  method: string;
  status: string;
  paymentDate: string;
  accountingDate: string;
  reference: string | null;
  notes: string | null;
  apBillId: string | null;
  apBillNumber: string | null;
  version: number;
  matched: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function fetchBankAccounts(): Promise<
  { ok: true; data: { items: FinBankAccount[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/finance/bank-accounts", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinBankAccount[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createBankAccount(body: {
  code: string;
  label: string;
  bankName?: string;
  rib?: string;
  iban?: string;
  glAccountCode?: string;
  isDefault?: boolean;
  notes?: string;
}): Promise<{ ok: true; data: FinBankAccount } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/bank-accounts", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankAccount };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchBankLines(
  accountId: string,
  opts?: { status?: string },
): Promise<{ ok: true; data: { items: FinBankStatementLine[] } } | ApiFail> {
  try {
    const sp = new URLSearchParams();
    if (opts?.status) sp.set("status", opts.status);
    const qs = sp.toString();
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinBankStatementLine[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function addBankLines(
  accountId: string,
  lines: {
    lineDate: string;
    amount: number;
    reference?: string;
    counterparty?: string;
    memo?: string;
  }[],
): Promise<{ ok: true; data: { items: FinBankStatementLine[] } } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lines }),
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinBankStatementLine[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchBankMatchCandidates(
  lineId: string,
): Promise<{ ok: true; data: BankMatchCandidates } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-lines/${lineId}/candidates`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as BankMatchCandidates };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function matchBankLine(
  lineId: string,
  body: {
    paymentId?: string;
    instrumentId?: string;
    apPaymentId?: string;
    note?: string;
  },
): Promise<{ ok: true; data: FinBankStatementLine } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/bank-lines/${lineId}/match`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankStatementLine };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function unmatchBankLine(
  lineId: string,
): Promise<{ ok: true; data: FinBankStatementLine } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/bank-lines/${lineId}/unmatch`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankStatementLine };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchApPayments(): Promise<
  { ok: true; data: { items: FinApPayment[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/finance/ap-payments?limit=50", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinApPayment[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createApPayment(body: {
  vendorName?: string;
  amount: number;
  method: string;
  paymentDate: string;
  reference?: string;
  notes?: string;
  apBillId?: string;
  applyRas?: boolean;
}): Promise<{ ok: true; data: FinApPayment } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/ap-payments", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinApPayment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type FinanceExpertiseHints = {
  companyId: string;
  fodec: { valueLabel: string; rateBps: number | null; lawRef: string | null } | null;
  timbre: { valueLabel: string; amountMilli: number | null; lawRef: string | null } | null;
  ras: { valueLabel: string; rateBps: number | null; lawRef: string | null } | null;
  tej: { valueLabel: string; lawRef: string | null } | null;
  rasPreview: {
    applied: boolean;
    amount: number;
    rateBps: number | null;
  } | null;
  tejTransmission: "DISABLED";
  prefsHref: string;
  note: string;
};

/** FODEC/timbre/RAS/TEJ readiness — never invents rates (D092/D246). */
export async function fetchFinanceExpertiseHints(opts?: {
  rasBase?: number;
}): Promise<{ ok: true; data: FinanceExpertiseHints } | ApiFail> {
  try {
    const sp = new URLSearchParams();
    if (opts?.rasBase != null && Number.isFinite(opts.rasBase)) {
      sp.set("rasBase", String(opts.rasBase));
    }
    const qs = sp.toString();
    const res = await fetch(
      `/api/v1/finance/expertise-hints${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinanceExpertiseHints };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchApBills(opts?: {
  q?: string;
  status?: string;
  limit?: number;
}): Promise<{ ok: true; data: { items: FinApBill[] } } | ApiFail> {
  try {
    const sp = new URLSearchParams();
    if (opts?.q?.trim()) sp.set("q", opts.q.trim());
    if (opts?.status) sp.set("status", opts.status);
    if (opts?.limit) sp.set("limit", String(opts.limit));
    const qs = sp.toString();
    const res = await fetch(
      `/api/v1/finance/ap-bills${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: FinApBill[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchApBill(
  id: string,
): Promise<{ ok: true; data: FinApBill } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/ap-bills/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinApBill };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createApBill(body: {
  vendorName?: string;
  supplierId?: string;
  amountTotal: number;
  billDate: string;
  dueDate?: string;
  label?: string;
  reference?: string;
  notes?: string;
  currency?: string;
}): Promise<{ ok: true; data: FinApBill } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/ap-bills", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinApBill };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function postApBill(
  id: string,
): Promise<{ ok: true; data: FinApBill } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/ap-bills/${id}/post`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinApBill };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function cancelApBill(
  id: string,
): Promise<{ ok: true; data: FinApBill } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/ap-bills/${id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinApBill };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchBankTreasury(): Promise<
  { ok: true; data: BankTreasury } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/finance/bank-treasury", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as BankTreasury };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function previewBankCsv(
  accountId: string,
  csv: string,
): Promise<{ ok: true; data: BankCsvPreview } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines/csv/preview`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csv }),
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as BankCsvPreview };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function importBankCsv(
  accountId: string,
  csv: string,
): Promise<
  | { ok: true; data: { items: FinBankStatementLine[]; skippedErrors: number } }
  | ApiFail
> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines/csv`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csv }),
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinBankStatementLine[];
        skippedErrors: number;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function previewBankOfx(
  accountId: string,
  ofx: string,
): Promise<{ ok: true; data: BankOfxPreview } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines/ofx/preview`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ofx }),
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as BankOfxPreview };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function importBankOfx(
  accountId: string,
  ofx: string,
): Promise<
  | {
      ok: true;
      data: {
        items: FinBankStatementLine[];
        skippedDuplicates: number;
        skippedErrors: number;
      };
    }
  | ApiFail
> {
  try {
    const res = await fetch(
      `/api/v1/finance/bank-accounts/${accountId}/lines/ofx`,
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ofx }),
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: FinBankStatementLine[];
        skippedDuplicates: number;
        skippedErrors: number;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function postBankFee(
  lineId: string,
): Promise<{ ok: true; data: FinBankStatementLine } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/bank-lines/${lineId}/post-fee`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankStatementLine };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function ignoreBankLine(
  lineId: string,
  memo?: string,
): Promise<{ ok: true; data: FinBankStatementLine } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/bank-lines/${lineId}/ignore`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ memo }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankStatementLine };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function unignoreBankLine(
  lineId: string,
): Promise<{ ok: true; data: FinBankStatementLine } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/bank-lines/${lineId}/unignore`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinBankStatementLine };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export function bankLineBadgeTone(
  status: BankLineStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "MATCHED") return "success";
  if (status === "UNMATCHED") return "warning";
  return "neutral";
}

/** D190/D194 dunning — confirm then optional SMTP / WA Cloud */
export type DunningChannel = "EMAIL" | "WHATSAPP";
export type DunningStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export type DunningSendStatus = "NONE" | "SENT" | "FAILED";

export type DunningPreview = {
  openItemId: string;
  number: string;
  customerId: string;
  customerName: string | null;
  amountOpen: string;
  currency: string;
  dueDate: string | null;
  daysPastDue: number;
  milestoneDay: number | null;
  matchedMilestones: number[];
  eligible: boolean;
  blockReason: string | null;
  hasOpenPromise: boolean;
  subject: string;
  body: string;
  contacts: {
    id: string;
    name: string;
    email: string | null;
    whatsapp: string | null;
    role: string | null;
  }[];
};

export type DunningWaDeliveryStatus =
  | "NONE"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export type FinDunningDraft = {
  id: string;
  number: string;
  openItemId: string;
  channel: DunningChannel;
  milestoneDay: number;
  daysPastDue: number;
  amountOpen: string;
  currency: string;
  subject: string;
  body: string;
  recipient: string;
  status: DunningStatus;
  sendStatus: DunningSendStatus;
  sentAt: string | null;
  sendError: string | null;
  providerMessageId: string | null;
  waDeliveryStatus: DunningWaDeliveryStatus;
  waDeliveryAt: string | null;
  waDeliveryError: string | null;
  channelConfigured: boolean;
  mailtoHref: string | null;
  waMeHref: string | null;
  confirmedAt: string | null;
};

export async function fetchDunningPreview(
  openItemId: string,
): Promise<{ ok: true; data: DunningPreview } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/finance/open-items/${openItemId}/dunning/preview`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DunningPreview };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function prepareDunning(body: {
  openItemId: string;
  contactId: string;
  channel: DunningChannel;
}): Promise<{ ok: true; data: FinDunningDraft } | ApiFail> {
  try {
    const res = await fetch("/api/v1/finance/dunning/prepare", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinDunningDraft };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function confirmDunning(
  id: string,
): Promise<{ ok: true; data: FinDunningDraft } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/dunning/${id}/confirm`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinDunningDraft };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function sendDunning(
  id: string,
): Promise<{ ok: true; data: FinDunningDraft } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/finance/dunning/${id}/send`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as FinDunningDraft };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

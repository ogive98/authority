export type SupplierStatus = "ACTIVE" | "ON_HOLD" | "BLOCKED" | "ARCHIVED";

export type SupplierCategory =
  | "LAIT"
  | "EMBALLAGE"
  | "FOURNITURE"
  | "IMPORT";

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  LAIT: "Lait",
  EMBALLAGE: "Emballage",
  FOURNITURE: "Fourniture",
  IMPORT: "Import",
};

export const SUPPLIER_STATUS_LABELS: Record<SupplierStatus, string> = {
  ACTIVE: "Actif",
  ON_HOLD: "En hold",
  BLOCKED: "Bloqué",
  ARCHIVED: "Archivé",
};

export type SupplierContact = {
  id: string;
  supplierId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  language: string | null;
  active: boolean;
  isPrimary: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Supplier = {
  id: string;
  companyId: string;
  partyId: string;
  code: string;
  legalName: string;
  taxId: string | null;
  category: SupplierCategory;
  leadTimeDays: number | null;
  moqDefault: string | null;
  preferred: boolean;
  qualityHold: boolean;
  paymentTerms: string | null;
  notes: string | null;
  status: SupplierStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: SupplierContact[];
};

type ApiFail = { ok: false; status: number; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  let message = res.statusText || "Erreur";
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (typeof body.message === "string") message = body.message;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function fetchSuppliers(
  q?: string,
  status?: SupplierStatus | "",
): Promise<{ ok: true; data: { items: Supplier[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (q?.trim()) sp.set("q", q.trim());
  if (status) sp.set("status", status);
  const qs = sp.toString();
  const res = await fetch(`/api/v1/suppliers${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: Supplier[] },
  };
}

export async function fetchSupplier(
  id: string,
): Promise<{ ok: true; data: Supplier } | ApiFail> {
  const res = await fetch(`/api/v1/suppliers/${id}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as Supplier };
}

export async function createSupplier(body: {
  code: string;
  legalName: string;
  taxId?: string;
  category?: SupplierCategory;
  leadTimeDays?: number;
  moqDefault?: number;
  preferred?: boolean;
  paymentTerms?: string;
  notes?: string;
  contacts?: Array<{
    name: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    role?: string;
    isPrimary?: boolean;
  }>;
}): Promise<{ ok: true; data: Supplier } | ApiFail> {
  const res = await fetch("/api/v1/suppliers", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as Supplier };
}

export async function updateSupplier(
  id: string,
  body: {
    version: number;
    legalName?: string;
    taxId?: string | null;
    category?: SupplierCategory;
    leadTimeDays?: number | null;
    moqDefault?: number | null;
    preferred?: boolean;
    paymentTerms?: string | null;
    notes?: string | null;
    status?: SupplierStatus;
  },
): Promise<{ ok: true; data: Supplier } | ApiFail> {
  const res = await fetch(`/api/v1/suppliers/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as Supplier };
}

export async function setSupplierHold(
  id: string,
  body: { version: number; qualityHold: boolean; setOnHoldStatus?: boolean },
): Promise<{ ok: true; data: Supplier } | ApiFail> {
  const res = await fetch(`/api/v1/suppliers/${id}/hold`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as Supplier };
}

export async function addSupplierContact(
  id: string,
  body: {
    name: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    role?: string;
    isPrimary?: boolean;
  },
): Promise<{ ok: true; data: SupplierContact } | ApiFail> {
  const res = await fetch(`/api/v1/suppliers/${id}/contacts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as SupplierContact };
}

export type SupplierSummary = {
  supplier: Supplier;
  counts: {
    contacts: number;
    draftBills: number;
    postedBills: number;
    payments: number;
  };
  ap: { openTotal: string; paidTotal: string; currency: string };
  actionRequired: Array<{
    id: string;
    severity: string;
    code: string;
    label: string;
    href?: string;
  }>;
  recent: {
    bills: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      billDate: string;
      createdAt: string;
    }>;
    payments: Array<{
      id: string;
      number: string;
      status: string;
      amount: string;
      paymentDate: string | null;
      createdAt: string;
      apBillId: string | null;
    }>;
  };
};

export type SupplierTimelineItem = {
  id: string;
  kind: "ap_bill" | "ap_payment";
  at: string;
  title: string;
  subtitle: string | null;
  status: string;
  href: string;
  amount: string | null;
};

export async function fetchSupplierSummary(
  id: string,
): Promise<{ ok: true; data: SupplierSummary } | ApiFail> {
  const res = await fetch(`/api/v1/suppliers/${id}/summary`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as SupplierSummary };
}

export async function fetchSupplierTimeline(
  id: string,
  opts?: { limit?: number },
): Promise<{ ok: true; data: { items: SupplierTimelineItem[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.limit) sp.set("limit", String(opts.limit));
  const qs = sp.toString();
  const res = await fetch(
    `/api/v1/suppliers/${id}/timeline${qs ? `?${qs}` : ""}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: SupplierTimelineItem[] },
  };
}

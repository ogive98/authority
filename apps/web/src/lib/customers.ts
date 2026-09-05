export type CustomerStatus = "ACTIVE" | "INACTIVE";

export type CustomerContact = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  active: boolean;
  version: number;
};

export type CustomerZone = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type Customer = {
  id: string;
  companyId: string;
  partyId: string;
  code: string;
  legalName: string;
  nickname: string | null;
  taxId: string | null;
  salesRep: string | null;
  paymentTerms: string | null;
  creditLimit: string | null;
  zoneId: string | null;
  zoneCode: string | null;
  zoneName: string | null;
  blocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  status: CustomerStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: CustomerContact[];
};

export type CustomerListResponse = {
  items: Customer[];
  nextCursor: string | null;
};

export type CustomerWriteBody = {
  code?: string;
  legalName: string;
  nickname?: string;
  taxId?: string;
  salesRep?: string;
  paymentTerms?: string;
  creditLimit?: string;
  zoneId?: string | null;
  contacts?: Array<{
    name: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    role?: string;
  }>;
  version?: number;
};

export const STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
};

type ApiError = {
  ok: false;
  status: number;
  code?: string;
  message: string;
};

async function parseError(res: Response): Promise<ApiError> {
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

export async function fetchCustomers(
  q?: string,
): Promise<{ ok: true; data: CustomerListResponse } | ApiError> {
  try {
    const url = q?.trim()
      ? `/api/v1/customers?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/customers";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerListResponse };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCustomer(
  id: string,
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCustomerZones(): Promise<
  { ok: true; data: CustomerZone[] } | ApiError
> {
  try {
    const res = await fetch("/api/v1/customers/zones", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerZone[] };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createCustomerZone(body: {
  code: string;
  name: string;
}): Promise<{ ok: true; data: CustomerZone } | ApiError> {
  try {
    const res = await fetch("/api/v1/customers/zones", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerZone };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createCustomer(
  body: CustomerWriteBody,
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch("/api/v1/customers", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function updateCustomer(
  id: string,
  body: CustomerWriteBody & { version: number },
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function setCustomerCredit(
  id: string,
  body: { creditLimit: string; version: number },
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}/credit`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function blockCustomer(
  id: string,
  body: { reason?: string; version: number },
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}/block`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function unblockCustomer(
  id: string,
  body: { version: number },
): Promise<{ ok: true; data: Customer } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}/unblock`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as Customer };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function archiveCustomer(
  id: string,
): Promise<{ ok: true } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return parseError(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function addCustomerContact(
  customerId: string,
  body: {
    name: string;
    phone?: string;
    email?: string;
    role?: string;
  },
): Promise<{ ok: true; data: CustomerContact } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${customerId}/contacts`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerContact };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

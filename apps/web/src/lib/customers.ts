export type CustomerStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "PROSPECT"
  | "ON_HOLD"
  | "ARCHIVED";

export type CustomerContact = {
  id: string;
  customerId: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role: string | null;
  language: string | null;
  active: boolean;
  isPrimary: boolean;
  canOrder: boolean;
  receiveInvoices: boolean;
  receiveDeliveryNotes: boolean;
  receiveNotifications: boolean;
  receiveDunning: boolean;
  portalAccess: boolean;
  version: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CustomerAddress = {
  id: string;
  customerId: string;
  type: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  governorate: string | null;
  postalCode: string | null;
  instructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  isPrimary: boolean;
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
  salubritaEmail: boolean;
  salubritaWhatsapp: boolean;
  salubritaPortal: boolean;
  enableCreditControl?: boolean;
  alertBeforeCreditLimit?: boolean;
  blockOnCreditLimit?: boolean;
  allowExceptionalOverride?: boolean;
  blockOnCriticalOverdue?: boolean;
  notifyResponsible?: boolean;
  creditStatus?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  contacts?: CustomerContact[];
  addresses?: CustomerAddress[];
  prices?: CustomerPrice[];
};

export type CustomerPrice = {
  id: string;
  customerId: string;
  productId: string;
  productSku: string | null;
  productName: string | null;
  unitPriceHt: string;
  currency: string;
  version: number;
  updatedAt: string;
};

export type CustomerListResponse = {
  items: Customer[];
  nextCursor: string | null;
};

export type CustomerAddressType =
  | "HQ"
  | "BILLING"
  | "SHIPPING"
  | "WAREHOUSE"
  | "STORE"
  | "POS";

export const ADDRESS_TYPE_LABELS: Record<CustomerAddressType, string> = {
  HQ: "Siège",
  BILLING: "Facturation",
  SHIPPING: "Livraison",
  WAREHOUSE: "Entrepôt",
  STORE: "Magasin",
  POS: "Point de vente",
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
  status?: CustomerStatus;
  salubritaEmail?: boolean;
  salubritaWhatsapp?: boolean;
  salubritaPortal?: boolean;
  enableCreditControl?: boolean;
  alertBeforeCreditLimit?: boolean;
  blockOnCreditLimit?: boolean;
  allowExceptionalOverride?: boolean;
  blockOnCriticalOverdue?: boolean;
  notifyResponsible?: boolean;
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
  PROSPECT: "Prospect",
  ON_HOLD: "En pause",
  ARCHIVED: "Archivé",
};

export type CustomerActionRequired = {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  code: string;
  label: string;
  href?: string;
};

export type CustomerSummary = {
  customer: Customer;
  finance: {
    customerId: string;
    credit: {
      creditLimit: string | null;
      outstandingBalance: string;
    };
    aging: {
      customerId?: string;
      asOf?: string;
      currency?: string;
      totalOpen?: string;
      overdueTotal?: string;
      buckets: Array<{
        key: string;
        label: string;
        amountOpen: string;
        count: number;
      }>;
    };
    openCount: number;
    overdueCount: number;
    availableCredit: string | null;
    creditPressure: {
      level: "ok" | "warn" | "breach" | null;
      ratio: number | null;
      warnRatio: number | null;
    };
    currency: string;
  };
  counts: {
    openOrders: number;
    draftOrders: number;
    openInvoices: number;
    recentPayments: number;
    openDeliveries: number;
    portalMembers: number;
    contacts: number;
    addresses: number;
  };
  actionRequired: CustomerActionRequired[];
  recent: {
    orders: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      createdAt: string;
    }>;
    invoices: Array<{
      id: string;
      number: string;
      status: string;
      amountTotal: string;
      issuedAt: string | null;
      createdAt: string;
    }>;
    payments: Array<{
      id: string;
      number: string;
      status: string;
      amount: string;
      paymentDate: string | null;
      createdAt: string;
    }>;
    deliveries: Array<{
      id: string;
      number: string;
      status: string;
      createdAt: string;
    }>;
  };
};

export type CustomerTimelineItem = {
  id: string;
  kind: "order" | "invoice" | "payment" | "delivery" | "claim";
  at: string;
  title: string;
  subtitle: string | null;
  status: string;
  href: string;
  amount: string | null;
};

export type CustomerTimeline = {
  items: CustomerTimelineItem[];
  nextCursor: string | null;
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

export async function fetchCustomerSummary(
  id: string,
): Promise<{ ok: true; data: CustomerSummary } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${id}/summary`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerSummary };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCustomerTimeline(
  id: string,
  opts?: { limit?: number; cursor?: string },
): Promise<{ ok: true; data: CustomerTimeline } | ApiError> {
  try {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/customers/${id}/timeline${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerTimeline };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type CustomerDocumentItem = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  visibility: string;
  linkType: string;
  linkId: string | null;
  createdAt: string;
};

export type CustomerDocuments = {
  items: CustomerDocumentItem[];
  nextCursor: string | null;
};

export type CustomerCommunications = {
  channels: {
    salubritaEmail: boolean;
    salubritaWhatsapp: boolean;
    salubritaPortal: boolean;
    contactsWithEmail: number;
    contactsWithWhatsapp: number;
  };
  contacts: Array<{
    id: string;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    isPrimary: boolean;
    receiveInvoices: boolean;
    receiveDeliveryNotes: boolean;
    receiveDunning: boolean;
    portalAccess: boolean;
    active: boolean;
  }>;
  dunning: Array<{
    id: string;
    number: string;
    channel: string;
    status: string;
    sendStatus: string;
    recipient: string;
    subject: string;
    amountOpen: string;
    currency: string;
    milestoneDay: number;
    createdAt: string;
    sentAt: string | null;
    href: string;
  }>;
  paymentDeclarations: Array<{
    id: string;
    number: string;
    status: string;
    amount: string;
    currency: string;
    method: string;
    paymentDate: string;
    createdAt: string;
    href: string;
  }>;
};

export async function fetchCustomerDocuments(
  id: string,
  opts?: { limit?: number; cursor?: string },
): Promise<{ ok: true; data: CustomerDocuments } | ApiError> {
  try {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/customers/${id}/documents${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerDocuments };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCustomerCommunications(
  id: string,
  opts?: { limit?: number },
): Promise<{ ok: true; data: CustomerCommunications } | ApiError> {
  try {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/customers/${id}/communications${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerCommunications };
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
    whatsapp?: string;
    email?: string;
    role?: string;
    language?: string;
    isPrimary?: boolean;
    canOrder?: boolean;
    receiveInvoices?: boolean;
    receiveDeliveryNotes?: boolean;
    receiveNotifications?: boolean;
    receiveDunning?: boolean;
    portalAccess?: boolean;
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

export async function createCustomerAddress(
  customerId: string,
  body: {
    type: CustomerAddressType;
    label?: string;
    line1: string;
    line2?: string;
    city?: string;
    governorate?: string;
    postalCode?: string;
    instructions?: string;
    contactName?: string;
    contactPhone?: string;
    isPrimary?: boolean;
  },
): Promise<{ ok: true; data: CustomerAddress } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${customerId}/addresses`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerAddress };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function deleteCustomerAddress(
  customerId: string,
  addressId: string,
): Promise<{ ok: true } | ApiError> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/addresses/${addressId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) return parseError(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function upsertCustomerPrice(
  customerId: string,
  body: { productId: string; unitPriceHt: number; currency?: string },
): Promise<{ ok: true; data: CustomerPrice } | ApiError> {
  try {
    const res = await fetch(`/api/v1/customers/${customerId}/prices`, {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CustomerPrice };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function deleteCustomerPrice(
  customerId: string,
  productId: string,
): Promise<{ ok: true } | ApiError> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/prices/${productId}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) return parseError(res);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function suggestCustomerPrice(
  customerId: string,
  productId: string,
): Promise<
  | { ok: true; data: { unitPrice: string | null; source: "agreed" | "last" | null } }
  | ApiError
> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/suggest-price?productId=${encodeURIComponent(productId)}`,
      { credentials: "include", headers: { Accept: "application/json" } },
    );
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as {
        unitPrice: string | null;
        source: "agreed" | "last" | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type PortalMembershipRole = "buyer" | "viewer" | "admin";
export type PortalMembershipStatus = "ACTIVE" | "REVOKED";

export const PORTAL_ROLE_LABELS: Record<PortalMembershipRole, string> = {
  buyer: "Acheteur",
  viewer: "Lecture",
  admin: "Admin portail",
};

export type PortalMembership = {
  id: string;
  customerId: string;
  userId: string;
  email: string;
  displayName: string;
  userStatus: string;
  role: string;
  status: PortalMembershipStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PortalLinkableUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  membershipId: string | null;
  membershipStatus: PortalMembershipStatus | null;
};

export async function fetchPortalMemberships(
  customerId: string,
): Promise<{ ok: true; data: { items: PortalMembership[] } } | ApiError> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/portal-memberships`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as { items: PortalMembership[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchPortalLinkableUsers(
  customerId: string,
  q?: string,
): Promise<{ ok: true; data: { items: PortalLinkableUser[] } } | ApiError> {
  try {
    const qs = q?.trim()
      ? `?q=${encodeURIComponent(q.trim())}`
      : "";
    const res = await fetch(
      `/api/v1/customers/${customerId}/portal-linkable-users${qs}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as { items: PortalLinkableUser[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createPortalMembership(
  customerId: string,
  body: { userId: string; role?: PortalMembershipRole },
): Promise<{ ok: true; data: PortalMembership } | ApiError> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/portal-memberships`,
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
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as PortalMembership };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function updatePortalMembership(
  customerId: string,
  membershipId: string,
  body: {
    role?: PortalMembershipRole;
    status?: PortalMembershipStatus;
    version: number;
  },
): Promise<{ ok: true; data: PortalMembership } | ApiError> {
  try {
    const res = await fetch(
      `/api/v1/customers/${customerId}/portal-memberships/${membershipId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as PortalMembership };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export const PORTAL_LOGIN_PATH = "/portal/login";
export const PORTAL_HOME_PATH = "/portal";
export const PORTAL_ORDERS_PATH = "/portal/orders";
export const PORTAL_ORDERS_NEW_PATH = "/portal/orders/new";
export const PORTAL_DELIVERIES_PATH = "/portal/deliveries";
export const PORTAL_FINANCE_PATH = "/portal/finance";
export const PORTAL_CLAIMS_PATH = "/portal/claims";
export const PORTAL_COOKIE_NAME = "authority_customer_portal_session";

export const PORTAL_API = {
  login: "/api/v1/customer-portal/auth/login",
  logout: "/api/v1/customer-portal/auth/logout",
  me: "/api/v1/customer-portal/me",
  dashboard: "/api/v1/customer-portal/dashboard",
  catalog: "/api/v1/customer-portal/catalog",
  orders: "/api/v1/customer-portal/orders",
  deliveries: "/api/v1/customer-portal/deliveries",
  financeOpenItems: "/api/v1/customer-portal/finance/open-items",
  financeCredit: "/api/v1/customer-portal/finance/credit",
  claims: "/api/v1/customer-portal/claims",
} as const;

export type PortalMe = {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  };
  membership: {
    id: string;
    customerId: string;
    companyId: string;
    role: string;
    status: string;
  };
  customer: {
    id: string;
    code: string;
    legalName: string;
    blocked: boolean;
  };
  realm: "customer_portal";
};

export type PortalDashboard = {
  kpis: {
    openOrders: number;
    pendingDeliveries: number;
    outstandingBalance: number | null;
    openClaims?: number;
  };
  sections: string[];
  message: string;
};

export type PortalOrderStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";

export type PortalOrderLine = {
  sku: string | null;
  name: string | null;
  qty: string;
  unitPrice: string;
  lineTotal: string;
};

export type PortalOrder = {
  id: string;
  number: string;
  status: PortalOrderStatus;
  requestedDate: string | null;
  currency: string;
  amountTotal: string;
  preferredDriver: string | null;
  confirmedAt: string | null;
  createdAt: string;
  lines: PortalOrderLine[];
};

export type PortalOrderList = {
  items: PortalOrder[];
  nextCursor: string | null;
};

export type PortalCatalogItem = {
  id: string;
  sku: string;
  name: string;
  uom: string;
  lastUnitPrice: string | null;
  currency: string;
};

export type PortalCatalogList = {
  items: PortalCatalogItem[];
  nextCursor: string | null;
};

export type PortalDeliveryStatus =
  | "READY"
  | "ASSIGNED"
  | "OUT"
  | "DELIVERED"
  | "FAILED";

export type PortalDelivery = {
  id: string;
  number: string;
  orderId: string;
  orderNumber: string | null;
  status: PortalDeliveryStatus;
  driverLabel: string | null;
  failReason: string | null;
  assignedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type PortalDeliveryList = {
  items: PortalDelivery[];
  nextCursor: string | null;
};

export type PortalOpenItemStatus = "OPEN" | "PARTIAL" | "CLOSED";

export type PortalOpenItem = {
  id: string;
  number: string;
  status: PortalOpenItemStatus;
  currency: string;
  amountTotal: string;
  amountOpen: string;
  dueDate: string | null;
  label: string | null;
  createdAt: string;
  allocations: {
    amount: string;
    paidAt: string;
    note: string | null;
  }[];
};

export type PortalOpenItemList = {
  items: PortalOpenItem[];
  nextCursor: string | null;
};

export type PortalCredit = {
  creditLimit: string | null;
  outstandingBalance: string;
  currency: string;
};

export type PortalClaimType =
  | "DELIVERY"
  | "QUALITY"
  | "QUANTITY"
  | "BILLING"
  | "OTHER";

export type PortalClaimStatus =
  | "OPEN"
  | "UNDER_REVIEW"
  | "ACTION_REQUIRED"
  | "RESOLVED"
  | "CLOSED";

export type PortalClaim = {
  id: string;
  number: string;
  type: PortalClaimType;
  status: PortalClaimStatus;
  subject: string;
  description: string;
  orderId: string | null;
  orderNumber: string | null;
  shipmentId: string | null;
  shipmentNumber: string | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PortalClaimList = {
  items: PortalClaim[];
  nextCursor: string | null;
};

/** App pages hide the portal (404) unless Customer Portal realm session is valid. */
export function shouldHidePortal(httpStatus: number): boolean {
  return httpStatus !== 200;
}

function apiOrigin(): string {
  return process.env.AUTHORITY_API_ORIGIN ?? "http://127.0.0.1:3001";
}

async function cookieHeader(): Promise<string> {
  const { cookies } = await import("next/headers");
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function portalFetch<T>(
  path: string,
): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(`${apiOrigin()}${path}`, {
      headers: {
        Accept: "application/json",
        cookie: await cookieHeader(),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      return { status: res.status, data: null };
    }
    const data = (await res.json()) as T;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: null };
  }
}

export async function fetchPortalMe(): Promise<{
  status: number;
  data: PortalMe | null;
}> {
  return portalFetch<PortalMe>(PORTAL_API.me);
}

export async function fetchPortalDashboard(): Promise<{
  status: number;
  data: PortalDashboard | null;
}> {
  return portalFetch<PortalDashboard>(PORTAL_API.dashboard);
}

export async function fetchOrders(opts?: {
  q?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalOrderList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalOrderList>(
    `${PORTAL_API.orders}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchOrder(
  id: string,
): Promise<{ status: number; data: PortalOrder | null }> {
  return portalFetch<PortalOrder>(`${PORTAL_API.orders}/${id}`);
}

export async function fetchCatalog(opts?: {
  q?: string;
  limit?: number;
}): Promise<{ status: number; data: PortalCatalogList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return portalFetch<PortalCatalogList>(
    `${PORTAL_API.catalog}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchDeliveries(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalDeliveryList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalDeliveryList>(
    `${PORTAL_API.deliveries}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchDelivery(
  id: string,
): Promise<{ status: number; data: PortalDelivery | null }> {
  return portalFetch<PortalDelivery>(`${PORTAL_API.deliveries}/${id}`);
}

export async function fetchPortalOpenItems(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalOpenItemList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalOpenItemList>(
    `${PORTAL_API.financeOpenItems}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchPortalOpenItem(
  id: string,
): Promise<{ status: number; data: PortalOpenItem | null }> {
  return portalFetch<PortalOpenItem>(`${PORTAL_API.financeOpenItems}/${id}`);
}

export async function fetchPortalCredit(): Promise<{
  status: number;
  data: PortalCredit | null;
}> {
  return portalFetch<PortalCredit>(PORTAL_API.financeCredit);
}

export async function fetchClaims(opts?: {
  q?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ status: number; data: PortalClaimList | null }> {
  const params = new URLSearchParams();
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return portalFetch<PortalClaimList>(
    `${PORTAL_API.claims}${qs ? `?${qs}` : ""}`,
  );
}

export async function fetchClaim(
  id: string,
): Promise<{ status: number; data: PortalClaim | null }> {
  return portalFetch<PortalClaim>(`${PORTAL_API.claims}/${id}`);
}

export function portalClaimTypeLabel(type: PortalClaimType): string {
  if (type === "DELIVERY") return "Livraison";
  if (type === "QUALITY") return "Qualité";
  if (type === "QUANTITY") return "Quantité";
  if (type === "BILLING") return "Facturation";
  return "Autre";
}

export function portalClaimStatusLabel(status: PortalClaimStatus): string {
  if (status === "UNDER_REVIEW") return "En revue";
  if (status === "ACTION_REQUIRED") return "Action requise";
  if (status === "RESOLVED") return "Résolue";
  if (status === "CLOSED") return "Clôturée";
  return "Ouverte";
}

export function portalClaimBadgeTone(
  status: PortalClaimStatus,
): "success" | "warning" | "accent" | "neutral" | "info" {
  if (status === "RESOLVED" || status === "CLOSED") return "success";
  if (status === "ACTION_REQUIRED") return "warning";
  if (status === "UNDER_REVIEW") return "info";
  return "accent";
}

export function portalOrderStatusLabel(status: PortalOrderStatus): string {
  if (status === "CONFIRMED") return "Confirmée";
  if (status === "CANCELLED") return "Annulée";
  return "Brouillon";
}

export function portalOrderBadgeTone(
  status: PortalOrderStatus,
): "success" | "warning" | "neutral" {
  if (status === "CONFIRMED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

export function portalDeliveryStatusLabel(
  status: PortalDeliveryStatus,
): string {
  if (status === "READY") return "Prêt";
  if (status === "ASSIGNED") return "Assigné";
  if (status === "OUT") return "En route";
  if (status === "DELIVERED") return "Livré";
  return "Échec";
}

export function portalDeliveryBadgeTone(
  status: PortalDeliveryStatus,
): "success" | "warning" | "accent" | "neutral" | "info" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED") return "warning";
  if (status === "OUT") return "accent";
  if (status === "ASSIGNED") return "info";
  return "neutral";
}

export function portalOpenItemStatusLabel(
  status: PortalOpenItemStatus,
): string {
  if (status === "CLOSED") return "Soldé";
  if (status === "PARTIAL") return "Partiel";
  return "Ouvert";
}

export function portalOpenItemBadgeTone(
  status: PortalOpenItemStatus,
): "success" | "warning" | "accent" | "neutral" {
  if (status === "CLOSED") return "success";
  if (status === "PARTIAL") return "warning";
  return "accent";
}

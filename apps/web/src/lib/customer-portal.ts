export const PORTAL_LOGIN_PATH = "/portal/login";
export const PORTAL_HOME_PATH = "/portal";
export const PORTAL_ORDERS_PATH = "/portal/orders";
export const PORTAL_COOKIE_NAME = "authority_customer_portal_session";

export const PORTAL_API = {
  login: "/api/v1/customer-portal/auth/login",
  logout: "/api/v1/customer-portal/auth/logout",
  me: "/api/v1/customer-portal/me",
  dashboard: "/api/v1/customer-portal/dashboard",
  orders: "/api/v1/customer-portal/orders",
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

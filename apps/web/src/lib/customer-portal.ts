export const PORTAL_LOGIN_PATH = "/portal/login";
export const PORTAL_HOME_PATH = "/portal";
export const PORTAL_COOKIE_NAME = "authority_customer_portal_session";

export const PORTAL_API = {
  login: "/api/v1/customer-portal/auth/login",
  logout: "/api/v1/customer-portal/auth/logout",
  me: "/api/v1/customer-portal/me",
  dashboard: "/api/v1/customer-portal/dashboard",
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

export async function fetchPortalMe(): Promise<{
  status: number;
  data: PortalMe | null;
}> {
  try {
    const res = await fetch(`${apiOrigin()}${PORTAL_API.me}`, {
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
    const data = (await res.json()) as PortalMe;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: null };
  }
}

export async function fetchPortalDashboard(): Promise<{
  status: number;
  data: PortalDashboard | null;
}> {
  try {
    const res = await fetch(`${apiOrigin()}${PORTAL_API.dashboard}`, {
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
    const data = (await res.json()) as PortalDashboard;
    return { status: res.status, data };
  } catch {
    return { status: 503, data: null };
  }
}

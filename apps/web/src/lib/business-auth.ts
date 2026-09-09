/** Business realm auth helpers (ERP shell) — separate from portal / super-admin. */

export const BUSINESS_LOGIN_PATH = "/login";
export const BUSINESS_HOME_PATH = "/";
export const BUSINESS_COOKIE_NAME = "authority_business_session";

export const BUSINESS_API = {
  login: "/api/v1/identity/auth/login",
  logout: "/api/v1/identity/auth/logout",
  me: "/api/v1/identity/me",
  companies: "/api/v1/organization/companies",
  context: "/api/v1/organization/me/context",
} as const;

export type BusinessMe = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
  /** Company-scoped assignment (active tenancy). */
  roleCode?: string | null;
  roleLabel?: string | null;
};

export type BusinessCompany = {
  id: string;
  code: string;
  legalName: string;
  status: string;
};

export type BusinessLoginResult = {
  user: BusinessMe;
  session: { id: string; expiresAt: string };
  realm?: "business";
};

/** True when shell session is missing/invalid (redirect to /login). */
export function shouldHideShell(httpStatus: number): boolean {
  return httpStatus !== 200;
}

/** Relative in-app path only (open-redirect safe). */
export function safeBusinessNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return BUSINESS_HOME_PATH;
  }
  if (raw.startsWith(BUSINESS_LOGIN_PATH)) return BUSINESS_HOME_PATH;
  return raw;
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

async function businessServerFetch<T>(
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
    return { status: res.status, data: (await res.json()) as T };
  } catch {
    return { status: 503, data: null };
  }
}

export async function fetchBusinessMe(): Promise<{
  status: number;
  data: BusinessMe | null;
}> {
  return businessServerFetch<BusinessMe>(BUSINESS_API.me);
}

export async function loginBusiness(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; data: BusinessLoginResult }
  | { ok: false; status: number; message: string }
> {
  try {
    const res = await fetch(BUSINESS_API.login, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => ({}))) as BusinessLoginResult & {
      message?: string | string[];
    };
    if (!res.ok) {
      let message = "Connexion refusée.";
      if (Array.isArray(body.message)) message = body.message.join(" ");
      else if (typeof body.message === "string" && body.message.trim()) {
        message = body.message;
      }
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data: body };
  } catch {
    return {
      ok: false,
      status: 0,
      message:
        "API indisponible. Vérifiez que le serveur AUTHORITY (API) tourne.",
    };
  }
}

export async function logoutBusiness(): Promise<void> {
  try {
    await fetch(BUSINESS_API.logout, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    /* clear client-side nav anyway */
  }
}

export async function fetchBusinessMeClient(): Promise<
  | { ok: true; data: BusinessMe }
  | { ok: false; status: number; message: string }
> {
  try {
    const res = await fetch(BUSINESS_API.me, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: res.status === 401 ? "Session expirée." : `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as BusinessMe };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function updateBusinessMe(input: {
  displayName?: string;
  locale?: string;
  currentPassword?: string;
  password?: string;
}): Promise<
  | { ok: true; data: BusinessMe }
  | { ok: false; status: number; message: string }
> {
  try {
    const res = await fetch(BUSINESS_API.me, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => ({}))) as BusinessMe & {
      message?: string | string[];
    };
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (typeof body.message === "string") message = body.message;
      return { ok: false, status: res.status, message };
    }
    return { ok: true, data: body };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function listAssignedCompanies(): Promise<
  | { ok: true; data: BusinessCompany[] }
  | { ok: false; status: number; message: string }
> {
  try {
    const res = await fetch(BUSINESS_API.companies, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: (await res.json()) as BusinessCompany[] };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function setBusinessCompanyContext(
  companyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch(BUSINESS_API.context, {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ companyId }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      return {
        ok: false,
        message: body.message ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Réseau indisponible." };
  }
}

export function initialsFromName(displayName: string, email: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts[0] && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (email.slice(0, 2) || "?").toUpperCase();
}

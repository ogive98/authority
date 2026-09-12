/** Employee Portal client helpers (`/api/v1/employee-portal`). */

import type { AttAbsence, AttAbsenceType } from "@/lib/attendance";

export const EMPLOYEE_PORTAL_LOGIN_PATH = "/employee-portal/login";
export const EMPLOYEE_PORTAL_HOME_PATH = "/employee-portal";
export const EMPLOYEE_PORTAL_BULLETINS_PATH = "/employee-portal/bulletins";
export const EMPLOYEE_PORTAL_COOKIE_NAME =
  "authority_employee_portal_session";

export const EMPLOYEE_PORTAL_API = {
  login: "/api/v1/employee-portal/auth/login",
  logout: "/api/v1/employee-portal/auth/logout",
  me: "/api/v1/employee-portal/me",
  absences: "/api/v1/employee-portal/absences",
  calendar: "/api/v1/employee-portal/calendar",
  bulletins: "/api/v1/employee-portal/bulletins",
} as const;

export type EmployeePortalMe = {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: string;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  };
  employee: {
    employeeId: string;
    companyId: string;
    matricule: string;
    displayName: string;
    status: string;
  };
  realm: "employee_portal";
};

/** Own bulletin (portal-safe — no company/snapshot internals). */
export type PortalBulletin = {
  id: string;
  number: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  currency: string;
  pdfDocumentId: string | null;
  employeeName: string | null;
  matricule: string | null;
  contractNumber: string | null;
  annualTaxableBeforeAbat: string | null;
  abatChefAnnual: string | null;
  abatEnfantAnnual: string | null;
  abatTotalAnnual: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  createdAt: string;
};

/**
 * True when Employee Portal session is missing/invalid (redirect to login).
 * Do NOT treat 503/timeout as logout — Nest watch restarts are transient.
 */
export function shouldHideEmployeePortal(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 403;
}

/** API unreachable — keep cookie, show retry (not login). */
export function isEmployeePortalApiUnavailable(httpStatus: number): boolean {
  return httpStatus === 503 || httpStatus === 502 || httpStatus === 504;
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
      signal: AbortSignal.timeout(8_000),
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

export async function fetchEmployeePortalMe() {
  return portalFetch<EmployeePortalMe>(EMPLOYEE_PORTAL_API.me);
}

export async function fetchEmployeePortalAbsences() {
  return portalFetch<AttAbsence[]>(EMPLOYEE_PORTAL_API.absences);
}

export type PortalCreateAbsenceInput = {
  type: AttAbsenceType;
  startDate: string;
  endDate: string;
  reason?: string;
  notes?: string;
};

export async function downloadPortalBulletinPdf(
  id: string,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    const res = await fetch(
      `${EMPLOYEE_PORTAL_API.bulletins}/${encodeURIComponent(id)}/pdf`,
      { credentials: "include" },
    );
    if (!res.ok) {
      let message = "Téléchargement PDF impossible.";
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* ignore */
      }
      return { ok: false, status: res.status, message };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
      `bulletin-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

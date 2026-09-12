export const SA_LOGIN_PATH = "/super-admin/login";
export const SA_HOME_PATH = "/super-admin";
export const SA_REPAIR_PATH = "/super-admin/repair";

export type SaHealth = {
  status: string;
  realm: string;
  timestamp: string;
};

/**
 * CC pages redirect to login unless Super Admin realm session is valid.
 * Do NOT treat 503/timeout as logout — Nest watch restarts are transient.
 */
export function shouldHideSuperAdminPortal(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 403 || httpStatus === 404;
}

/** API unreachable — keep cookie, show retry (not login). */
export function isSuperAdminApiUnavailable(httpStatus: number): boolean {
  return httpStatus === 503 || httpStatus === 502 || httpStatus === 504;
}

/** Safe post-login redirect within Control Center only. */
export function safeSuperAdminNext(raw: string | null | undefined): string {
  if (!raw) return SA_HOME_PATH;
  const path = raw.trim();
  if (!path.startsWith("/super-admin")) return SA_HOME_PATH;
  if (path.startsWith("//") || path.includes("://")) return SA_HOME_PATH;
  return path;
}

export const SA_NAV = [
  { href: "/super-admin", label: "Accueil", icon: "home" },
  { href: "/super-admin/repair", label: "Repair", icon: "repair" },
  { href: "/super-admin/modules", label: "Modules", icon: "modules" },
  { href: "/super-admin/flags", label: "Flags", icon: "flags" },
  { href: "/super-admin/license", label: "Licence", icon: "license" },
  { href: "/super-admin/jobs", label: "Jobs / DLQ", icon: "jobs" },
] as const;

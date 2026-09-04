export const SA_LOGIN_PATH = "/super-admin/login";
export const SA_HOME_PATH = "/super-admin";

export type SaHealth = {
  status: string;
  realm: string;
  timestamp: string;
};

/** CC pages hide the portal (404) unless Super Admin realm session is valid. */
export function shouldHideSuperAdminPortal(httpStatus: number): boolean {
  return httpStatus !== 200;
}

export const SA_NAV = [
  { href: "/super-admin", label: "Accueil" },
  { href: "/super-admin/modules", label: "Modules" },
  { href: "/super-admin/flags", label: "Flags" },
  { href: "/super-admin/license", label: "Licence" },
  { href: "/super-admin/jobs", label: "Jobs / DLQ" },
] as const;

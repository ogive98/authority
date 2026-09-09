/** Client helpers for identity users admin (`/api/v1/identity/users`). */

export type CompanyUserStatus =
  | "INVITED"
  | "ACTIVE"
  | "LOCKED"
  | "DISABLED";

export type CompanyUser = {
  id: string;
  email: string;
  displayName: string;
  status: CompanyUserStatus;
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
  roleCode: string | null;
  assignmentId: string;
  inviteExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessRole = {
  code: string;
  label: string;
  description: string;
};

export const STATUS_LABELS: Record<CompanyUserStatus, string> = {
  INVITED: "Invité",
  ACTIVE: "Actif",
  LOCKED: "Verrouillé",
  DISABLED: "Désactivé",
};

type ApiFail = { ok: false; status: number; message: string; code?: string };

async function parseError(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string | string[];
  };
  let message = `HTTP ${res.status}`;
  if (Array.isArray(body.message)) message = body.message.join(", ");
  else if (typeof body.message === "string") message = body.message;
  return { ok: false, status: res.status, code: body.code, message };
}

export async function fetchCompanyUsers(
  q?: string,
): Promise<{ ok: true; data: { items: CompanyUser[] } } | ApiFail> {
  try {
    const url = q?.trim()
      ? `/api/v1/identity/users?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/identity/users";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as { items: CompanyUser[] } };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchBusinessRoles(): Promise<
  { ok: true; data: { items: BusinessRole[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/identity/users/roles", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as { items: BusinessRole[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createCompanyUser(body: {
  email: string;
  displayName: string;
  password: string;
  roleCode: string;
}): Promise<{ ok: true; data: CompanyUser } | ApiFail> {
  try {
    const res = await fetch("/api/v1/identity/users", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CompanyUser };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type InviteIssue = {
  user: CompanyUser;
  inviteUrl: string | null;
  mailtoHref: string | null;
  expiresAt: string | null;
  alreadyActive: boolean;
};

export async function inviteCompanyUser(body: {
  email: string;
  displayName: string;
  roleCode: string;
}): Promise<{ ok: true; data: InviteIssue } | ApiFail> {
  try {
    const res = await fetch("/api/v1/identity/users/invite", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as InviteIssue };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function reinviteCompanyUser(
  id: string,
): Promise<{ ok: true; data: InviteIssue } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/identity/users/${id}/reinvite`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as InviteIssue };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function updateCompanyUser(
  id: string,
  body: {
    displayName?: string;
    status?: CompanyUserStatus;
    roleCode?: string;
    password?: string;
  },
): Promise<{ ok: true; data: CompanyUser } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/identity/users/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as CompanyUser };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type UserGrants = {
  userId: string;
  roleCode: string | null;
  catalog: string[];
  userAllow: string[];
  roleAllow: string[];
  companyUserAllow: string[];
  protectedKeys: string[];
};

export async function fetchUserGrants(
  id: string,
): Promise<{ ok: true; data: UserGrants } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/identity/users/${id}/grants`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as UserGrants };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function putUserGrants(
  id: string,
  allowKeys: string[],
): Promise<{ ok: true; data: UserGrants } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/identity/users/${id}/grants`, {
      method: "PUT",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ allowKeys }),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as UserGrants };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

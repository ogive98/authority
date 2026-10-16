/** Client helpers for Super Admin global role packs (`/api/super-admin/v1/roles`). */

export type SaRoleSummary = {
  code: string;
  label: string;
  description: string;
  globalAllowCount: number;
};

export type SaRoleGrants = {
  roleCode: string;
  label: string;
  description: string;
  catalog: string[];
  globalAllow: string[];
  globalDeny: string[];
  protectedKeys: string[];
};

type ApiFail = { ok: false; status: number; message: string };

async function parseError(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string | string[];
  };
  let message = `HTTP ${res.status}`;
  if (Array.isArray(body.message)) message = body.message.join(", ");
  else if (typeof body.message === "string" && body.message) message = body.message;
  return { ok: false, status: res.status, message };
}

export async function fetchSaRoles(): Promise<
  { ok: true; data: { items: SaRoleSummary[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/super-admin/v1/roles", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as { items: SaRoleSummary[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchSaRoleGrants(
  roleCode: string,
): Promise<{ ok: true; data: SaRoleGrants } | ApiFail> {
  try {
    const res = await fetch(
      `/api/super-admin/v1/roles/${encodeURIComponent(roleCode)}/grants`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as SaRoleGrants };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function putSaRoleGrants(
  roleCode: string,
  allowKeys: string[],
): Promise<{ ok: true; data: SaRoleGrants } | ApiFail> {
  try {
    const res = await fetch(
      `/api/super-admin/v1/roles/${encodeURIComponent(roleCode)}/grants`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ allowKeys }),
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as SaRoleGrants };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

/** Soft Glass helpers for AUTHORITY X device pairing (D274). */

export type AuthorityXDevice = {
  id: string;
  kind: string;
  name: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  pending: boolean;
};

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; code?: string };
    return body.message ?? body.code ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function fetchAuthorityXDevices(): Promise<AuthorityXDevice[]> {
  const res = await fetch("/api/v1/identity/devices", {
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = (await res.json()) as { items: AuthorityXDevice[] };
  return json.items ?? [];
}

export async function pairAuthorityXDevice(): Promise<{
  deviceId: string;
  code: string;
  expiresAt: string;
}> {
  const res = await fetch("/api/v1/identity/devices/pair", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    deviceId: string;
    code: string;
    expiresAt: string;
  }>;
}

export async function revokeAuthorityXDevice(id: string): Promise<void> {
  const res = await fetch(`/api/v1/identity/devices/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseError(res));
}

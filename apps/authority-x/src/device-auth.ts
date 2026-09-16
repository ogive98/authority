/**
 * AUTHORITY X device credential (D274).
 * Token lives in Electron safeStorage via IPC — never in localStorage as SoT.
 */

export type DeviceAuth = {
  token: string;
  deviceId: string;
  companyId: string;
  displayName: string;
  expiresAt: string;
};

const API_BASE =
  (import.meta as { env?: { VITE_AUTHORITY_API?: string } }).env
    ?.VITE_AUTHORITY_API ?? "http://127.0.0.1:3001";

let cached: DeviceAuth | null = null;

export function getCachedDeviceAuth(): DeviceAuth | null {
  return cached;
}

export async function loadDeviceAuth(): Promise<DeviceAuth | null> {
  if (window.authorityX?.getDeviceAuth) {
    cached = (await window.authorityX.getDeviceAuth()) ?? null;
    return cached;
  }
  return cached;
}

export async function saveDeviceAuth(auth: DeviceAuth): Promise<void> {
  cached = auth;
  if (window.authorityX?.setDeviceAuth) {
    await window.authorityX.setDeviceAuth(auth);
  }
}

export async function clearDeviceAuth(): Promise<void> {
  cached = null;
  if (window.authorityX?.clearDeviceAuth) {
    await window.authorityX.clearDeviceAuth();
  }
}

export function deviceAuthHeaders(): Record<string, string> {
  if (!cached?.token) return {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cached.token}`,
  };
  if (cached.companyId) {
    headers["X-Authority-Company-Id"] = cached.companyId;
  }
  return headers;
}

export async function claimPairCode(code: string): Promise<DeviceAuth> {
  const res = await fetch(`${API_BASE}/api/v1/identity/devices/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      code: code.trim(),
      name: "AUTHORITY X",
      fingerprint: navigator.userAgent.slice(0, 120),
    }),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const json = (await res.json()) as DeviceAuth;
  await saveDeviceAuth(json);
  return json;
}

export async function verifyDeviceAuth(): Promise<boolean> {
  const auth = await loadDeviceAuth();
  if (!auth?.token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/v1/identity/me`, {
      headers: { Accept: "application/json", ...deviceAuthHeaders() },
    });
    if (res.ok) return true;
    await clearDeviceAuth();
    return false;
  } catch {
    return Boolean(cached?.token);
  }
}

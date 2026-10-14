/** Client helpers for HACCP (`/api/v1/haccp`). */

export type HcpCcp = {
  id: string;
  code: string;
  name: string;
  criticalLimit: string;
  unit: string;
  active: boolean;
  siteId: string | null;
  createdAt: string;
};

export type HcpRecord = {
  id: string;
  ccpId: string;
  value: string;
  inSpec: boolean;
  recordedBy: string;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
};

export type HcpAudit = {
  id: string;
  auditDate: string;
  auditor: string;
  findings: Record<string, unknown> | null;
  status: string | null;
  createdAt: string;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store", ...init });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      return { ok: false, status: res.status, message: body.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchCcps(): Promise<ApiResult<HcpCcp[]>> {
  return api<HcpCcp[]>("/api/v1/haccp/ccps");
}

export async function createCcp(body: { code: string; name: string; criticalLimit: string; unit: string }): Promise<ApiResult<HcpCcp>> {
  return api<HcpCcp>("/api/v1/haccp/ccps", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchRecords(ccpId?: string): Promise<ApiResult<HcpRecord[]>> {
  const q = ccpId ? `?ccpId=${ccpId}` : "";
  return api<HcpRecord[]>(`/api/v1/haccp/records${q}`);
}

export async function createRecord(body: { ccpId: string; value: string; inSpec: boolean; recordedBy: string; recordedAt: string; notes?: string }): Promise<ApiResult<HcpRecord>> {
  return api<HcpRecord>("/api/v1/haccp/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchAudits(): Promise<ApiResult<HcpAudit[]>> {
  return api<HcpAudit[]>("/api/v1/haccp/audits");
}

export async function createAudit(body: { auditDate: string; auditor: string; findings?: Record<string, unknown>; status?: string }): Promise<ApiResult<HcpAudit>> {
  return api<HcpAudit>("/api/v1/haccp/audits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

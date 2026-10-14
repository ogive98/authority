/** Client helpers for Quality (`/api/v1/quality`). */

export type CheckTarget = "RECEIPT" | "PRODUCTION";
export type CheckResult = "PENDING" | "PASSED" | "FAILED";
export type NcrSeverity = "MINOR" | "MAJOR" | "CRITICAL";
export type NcrStatus = "OPEN" | "IN_PROGRESS" | "CLOSED";

export type QcCheck = {
  id: string;
  target: CheckTarget;
  targetId: string;
  lotId: string | null;
  result: CheckResult;
  measures: Record<string, unknown> | null;
  notes: string | null;
  checkedBy: string | null;
  createdAt: string;
};

export type QuaNcr = {
  id: string;
  severity: NcrSeverity;
  description: string;
  lotId: string | null;
  checkId: string | null;
  status: NcrStatus;
  disposition: string | null;
  openedBy: string | null;
  closedBy: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type LotHold = {
  id: string;
  lotId: string;
  reason: string;
  heldBy: string;
  releasedBy: string | null;
  createdAt: string;
  releasedAt: string | null;
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

export async function fetchChecks(): Promise<ApiResult<QcCheck[]>> {
  return api<QcCheck[]>("/api/v1/quality/checks");
}

export async function createCheck(body: { target: CheckTarget; targetId: string; lotId?: string; result?: CheckResult; notes?: string }): Promise<ApiResult<QcCheck>> {
  return api<QcCheck>("/api/v1/quality/checks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchNcrs(): Promise<ApiResult<QuaNcr[]>> {
  return api<QuaNcr[]>("/api/v1/quality/ncrs");
}

export async function createNcr(body: { severity: NcrSeverity; description: string; lotId?: string }): Promise<ApiResult<QuaNcr>> {
  return api<QuaNcr>("/api/v1/quality/ncrs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function closeNcr(id: string, body: { disposition: string; closedBy: string }): Promise<ApiResult<QuaNcr>> {
  return api<QuaNcr>(`/api/v1/quality/ncrs/${id}/close`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function holdLot(body: { lotId: string; reason: string; heldBy: string }): Promise<ApiResult<LotHold>> {
  return api<LotHold>("/api/v1/quality/lots/hold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function releaseLot(body: { lotId: string; releasedBy: string }): Promise<ApiResult<LotHold>> {
  return api<LotHold>("/api/v1/quality/lots/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

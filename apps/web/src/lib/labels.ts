/** Client helpers for Label Engine (`/api/v1/labels`). */

export type LblTemplate = {
  id: string;
  code: string;
  name: string;
  zpl: string;
  widthMm: number;
  heightMm: number;
  active: boolean;
  createdAt: string;
};

export type LblPrintLog = {
  id: string;
  templateId: string;
  lotId: string | null;
  data: Record<string, unknown> | null;
  status: string;
  printerName: string | null;
  printedAt: string;
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

export async function fetchTemplates(): Promise<ApiResult<LblTemplate[]>> {
  return api<LblTemplate[]>("/api/v1/labels/templates");
}

export async function createTemplate(body: { code: string; name: string; zpl: string; widthMm: number; heightMm: number }): Promise<ApiResult<LblTemplate>> {
  return api<LblTemplate>("/api/v1/labels/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function renderLabel(body: { templateId: string; lotId?: string; data?: Record<string, unknown>; printerName?: string }): Promise<ApiResult<{ zpl: string }>> {
  return api<{ zpl: string }>("/api/v1/labels/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function fetchPrintLogs(): Promise<ApiResult<LblPrintLog[]>> {
  return api<LblPrintLog[]>("/api/v1/labels/logs");
}

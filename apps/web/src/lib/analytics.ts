/** Client helpers for Analytics light (`/api/v1/analytics`). */

export type AnalyticsSummary = {
  asOf: string;
  currency: "TND";
  modules: {
    sales: boolean;
    finance: boolean;
    inventory: boolean;
    delivery: boolean;
  };
  sales: { draftCount: number; confirmedCount: number } | null;
  finance: {
    openCount: number;
    overdueCount: number;
    outstandingOpen: string;
  } | null;
  inventory: {
    balanceLines: number;
    positiveAvailableLines: number;
    openLots: number;
  } | null;
  delivery: {
    readyCount: number;
    assignedCount: number;
    outCount: number;
  } | null;
  note: string;
};

type ApiFail = { ok: false; status: number; message: string };
type ApiOk<T> = { ok: true; data: T };

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[]; code?: string };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.code) return body.code;
  } catch {
    /* ignore */
  }
  return res.statusText || "Erreur réseau";
}

export async function fetchAnalyticsSummary(): Promise<
  ApiOk<AnalyticsSummary> | ApiFail
> {
  const res = await fetch("/api/v1/analytics/summary", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AnalyticsSummary };
}

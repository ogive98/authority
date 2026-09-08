/** Client helpers for Settings / Préférences (`/api/v1/settings`). */

export type ExpertiseSlot = {
  key: string;
  domain: string;
  label: string;
  description: string;
  status: "VALIDATED" | "PENDING_EXPERT" | "NOT_APPLICABLE";
  lawRef: string | null;
  valueSummary: string | null;
  manageHref: string | null;
  expertValidatedAt: string | null;
};

export type ExpertiseCatalog = {
  companyId: string;
  pendingExpertCount: number;
  items: ExpertiseSlot[];
};

type ApiFail = { ok: false; status: number; message: string };

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      code?: string;
    };
    if (typeof body.message === "string") return body.message;
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (body.code) return body.code;
  } catch {
    /* ignore */
  }
  return res.statusText || "Erreur réseau";
}

export async function fetchExpertiseCatalog(): Promise<
  { ok: true; data: ExpertiseCatalog } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/settings/expertise", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, status: res.status, message: await parseError(res) };
    }
    return { ok: true, data: (await res.json()) as ExpertiseCatalog };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

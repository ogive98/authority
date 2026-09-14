export type AtmProfileMode = "ASSISTED" | "REQUIRES_APPROVAL" | "FULL_AUTO";
export type AtmTriggerKind =
  | "FINANCE_OVERDUE_OPEN_ITEMS"
  | "PORTAL_PAYMENT_DECLARATION_SUBMITTED"
  | "SALES_DRAFT_ORDER_STALE";
export type AtmActionKind =
  | "NOTIFY"
  | "PREPARE_DUNNING_HINT"
  | "ORDER_REVIEW_HINT";
export type AtmRunStatus =
  | "SUGGESTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SKIPPED"
  | "FAILED";

export type AtmProfile = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  mode: AtmProfileMode;
  triggerKind: AtmTriggerKind;
  actionKind: AtmActionKind;
  enabled: boolean;
  shadowMode: boolean;
  configJson: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type AtmRun = {
  id: string;
  profileId: string;
  profileCode: string | null;
  profileName: string | null;
  number: string;
  status: AtmRunStatus;
  triggerRef: string | null;
  summary: string;
  payloadJson: Record<string, unknown>;
  resultJson: Record<string, unknown>;
  version: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type AtmCatalog = {
  modes: Array<{ id: AtmProfileMode; label: string; allowed: boolean }>;
  triggers: Array<{ id: AtmTriggerKind; label: string }>;
  actions: Array<{ id: AtmActionKind; label: string }>;
};

type ApiFail = { ok: false; status: number; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  };
  return {
    ok: false,
    status: res.status,
    message: body.message ?? body.code ?? `HTTP ${res.status}`,
  };
}

export const ATM_MODE_LABELS: Record<AtmProfileMode, string> = {
  ASSISTED: "Assisté",
  REQUIRES_APPROVAL: "Approbation",
  FULL_AUTO: "Plein auto",
};

export const ATM_RUN_STATUS_LABELS: Record<AtmRunStatus, string> = {
  SUGGESTED: "Suggestion",
  PENDING_APPROVAL: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  SKIPPED: "Ignoré (shadow)",
  FAILED: "Échec",
};

export function atmModeBadgeTone(
  mode: AtmProfileMode,
): "accent" | "warning" | "neutral" | "danger" {
  if (mode === "ASSISTED") return "accent";
  if (mode === "REQUIRES_APPROVAL") return "warning";
  return "danger";
}

export function atmRunBadgeTone(
  status: AtmRunStatus,
): "success" | "warning" | "accent" | "neutral" | "danger" {
  if (status === "APPROVED") return "success";
  if (status === "SUGGESTED") return "accent";
  if (status === "PENDING_APPROVAL") return "warning";
  if (status === "REJECTED" || status === "FAILED") return "danger";
  return "neutral";
}

export async function fetchAutomationCatalog(): Promise<
  { ok: true; data: AtmCatalog } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/automation/catalog", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmCatalog };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchAtmProfiles(opts?: {
  q?: string;
  enabled?: boolean;
}): Promise<{ ok: true; data: { items: AtmProfile[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.q) params.set("q", opts.q);
    if (opts?.enabled === true) params.set("enabled", "1");
    if (opts?.enabled === false) params.set("enabled", "0");
    const qs = params.toString();
    const res = await fetch(
      `/api/v1/automation/profiles${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: AtmProfile[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchAtmProfile(
  id: string,
): Promise<{ ok: true; data: AtmProfile } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/automation/profiles/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmProfile };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createAtmProfile(body: {
  code: string;
  name: string;
  description?: string;
  mode: AtmProfileMode;
  triggerKind: AtmTriggerKind;
  actionKind: AtmActionKind;
  enabled?: boolean;
  shadowMode?: boolean;
}): Promise<{ ok: true; data: AtmProfile } | ApiFail> {
  try {
    const res = await fetch("/api/v1/automation/profiles", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmProfile };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function runAtmProfile(
  id: string,
  body?: { triggerRef?: string; staleDays?: number },
): Promise<{ ok: true; data: AtmRun } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/automation/profiles/${id}/run`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmRun };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchAtmRuns(opts?: {
  profileId?: string;
  status?: AtmRunStatus | "";
}): Promise<{ ok: true; data: { items: AtmRun[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.profileId) params.set("profileId", opts.profileId);
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    const res = await fetch(`/api/v1/automation/runs${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as { items: AtmRun[] } };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function approveAtmRun(
  id: string,
  body: { version: number; reviewNote?: string },
): Promise<{ ok: true; data: AtmRun } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/automation/runs/${id}/approve`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmRun };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function rejectAtmRun(
  id: string,
  body: { version: number; reviewNote?: string },
): Promise<{ ok: true; data: AtmRun } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/automation/runs/${id}/reject`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AtmRun };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

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
  writable: boolean;
  rateBps: number | null;
  amountMilli: number | null;
  notes: string | null;
};

export type ExpertiseCatalog = {
  companyId: string;
  pendingExpertCount: number;
  items: ExpertiseSlot[];
};

export type UpsertExpertiseInput = {
  valueLabel: string;
  lawRef: string;
  expertValidatedAt: string;
  rateBps?: number;
  amountMilli?: number;
  notes?: string;
};

type ApiFail = { ok: false; status: number; message: string; code?: string };

const FETCH_TIMEOUT_MS = 8_000;

async function parseError(res: Response): Promise<ApiFail> {
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      code?: string;
    };
    let message = res.statusText || "Erreur réseau";
    if (typeof body.message === "string") message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (body.code) message = body.code;

    if (res.status === 401) {
      message =
        "Session métier expirée — reconnectez-vous (demo@authority.local), puis choisissez la société.";
    } else if (
      res.status === 403 &&
      (body.code === "ORG.CONTEXT_FORBIDDEN" ||
        message.toLowerCase().includes("tenancy") ||
        message.toLowerCase().includes("company"))
    ) {
      message =
        "Contexte société manquant — sélectionnez une société (cookie tenancy) puis réessayez.";
    }

    return {
      ok: false,
      status: res.status,
      code: body.code,
      message,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      message:
        res.status === 401
          ? "Session métier expirée — reconnectez-vous."
          : res.statusText || "Erreur réseau",
    };
  }
}

/** Ensure company cookie exists when session is valid but tenancy is missing. */
async function ensureCompanyContext(): Promise<boolean> {
  try {
    const cos = await fetch("/api/v1/organization/companies", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!cos.ok) return false;
    const list = (await cos.json()) as Array<{ id: string }>;
    const companyId = list[0]?.id;
    if (!companyId) return false;
    const ctx = await fetch("/api/v1/organization/me/context", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ companyId }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return ctx.ok;
  } catch {
    return false;
  }
}

async function getExpertiseOnce(): Promise<
  { ok: true; data: ExpertiseCatalog } | ApiFail
> {
  const res = await fetch("/api/v1/settings/expertise", {
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return parseError(res);
  return { ok: true, data: (await res.json()) as ExpertiseCatalog };
}

export async function fetchExpertiseCatalog(): Promise<
  { ok: true; data: ExpertiseCatalog } | ApiFail
> {
  try {
    const first = await getExpertiseOnce();
    if (first.ok) return first;

    if (
      first.status === 403 &&
      (first.code === "ORG.CONTEXT_FORBIDDEN" ||
        first.message.toLowerCase().includes("company"))
    ) {
      const ok = await ensureCompanyContext();
      if (ok) return getExpertiseOnce();
    }

    return first;
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Réseau indisponible ou API arrêtée — redémarrez l’API puis réessayez.",
    };
  }
}

export async function upsertExpertise(
  slotKey: string,
  input: UpsertExpertiseInput,
): Promise<{ ok: true; data: ExpertiseSlot } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/settings/expertise/${encodeURIComponent(slotKey)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      },
    );
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as ExpertiseSlot };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type EffectiveSetting = {
  key: string;
  value: unknown;
  source: string;
  valueType: string;
  description: string | null;
  secretSet?: boolean;
};

export type EffectiveSettings = {
  companyId: string;
  settings: EffectiveSetting[];
};

export async function fetchEffectiveSettings(): Promise<
  { ok: true; data: EffectiveSettings } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/settings/effective", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      if (res.status === 403) {
        const ok = await ensureCompanyContext();
        if (ok) {
          const retry = await fetch("/api/v1/settings/effective", {
            credentials: "include",
            headers: { Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!retry.ok) return parseError(retry);
          return {
            ok: true,
            data: (await retry.json()) as EffectiveSettings,
          };
        }
      }
      return parseError(res);
    }
    return { ok: true, data: (await res.json()) as EffectiveSettings };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function putCompanySetting(
  key: string,
  value: unknown,
): Promise<{ ok: true; data: EffectiveSetting } | ApiFail> {
  return putSetting(key, value, "COMPANY");
}

export async function putUserSetting(
  key: string,
  value: unknown,
): Promise<{ ok: true; data: EffectiveSetting } | ApiFail> {
  return putSetting(key, value, "USER");
}

export async function putRoleSetting(
  key: string,
  value: unknown,
  roleCode: string,
): Promise<{ ok: true; data: EffectiveSetting } | ApiFail> {
  return putSetting(key, value, "ROLE", roleCode);
}

async function putSetting(
  key: string,
  value: unknown,
  level: "USER" | "COMPANY" | "ROLE",
  roleCode?: string,
): Promise<{ ok: true; data: EffectiveSetting } | ApiFail> {
  try {
    const res = await fetch("/api/v1/settings", {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        key,
        value,
        level,
        ...(roleCode ? { roleCode } : {}),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return parseError(res);
    return { ok: true, data: (await res.json()) as EffectiveSetting };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchSettingsCapabilities(): Promise<
  | { ok: true; data: { canWriteRole: boolean; roles: string[] } }
  | ApiFail
> {
  try {
    const res = await fetch("/api/v1/settings/capabilities", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return parseError(res);
    return {
      ok: true,
      data: (await res.json()) as { canWriteRole: boolean; roles: string[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type MailTestResult = {
  ok: true;
  to: string;
  from: string;
};

/** D150 — test SMTP to the signed-in admin (Préférences → Envois). */
export async function postMailTest(): Promise<MailTestResult | ApiFail> {
  const MAIL_TEST_TIMEOUT_MS = 20_000;
  try {
    const res = await fetch("/api/v1/settings/mail-test", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(MAIL_TEST_TIMEOUT_MS),
    });
    if (!res.ok) return parseError(res);
    const data = (await res.json()) as { ok: boolean; to: string; from: string };
    return { ok: true, to: data.to, from: data.from };
  } catch {
    return {
      ok: false,
      status: 0,
      message: "Timeout ou réseau — vérifiez SMTP / API.",
    };
  }
}

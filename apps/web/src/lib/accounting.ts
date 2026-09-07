export type AccAccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "REVENUE"
  | "EXPENSE";

export type AccAccount = {
  id: string;
  code: string;
  name: string;
  type: AccAccountType;
  active: boolean;
};

export type AccJournal = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type AccPeriod = {
  id: string;
  code: string;
  status: string;
  startDate: string;
  endDate: string;
};

export type TrialBalanceRow = {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: string;
  credit: string;
};

type ApiFail = { ok: false; status: number; code?: string; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  return {
    ok: false,
    status: res.status,
    code: body.code,
    message: body.message ?? `HTTP ${res.status}`,
  };
}

export async function fetchAccounts(): Promise<
  { ok: true; data: { items: AccAccount[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/accounting/accounts", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: AccAccount[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchJournals(): Promise<
  { ok: true; data: { items: AccJournal[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/accounting/journals", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: AccJournal[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchPeriods(): Promise<
  { ok: true; data: { items: AccPeriod[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/accounting/periods", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: AccPeriod[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchTrialBalance(
  periodId: string,
): Promise<{ ok: true; data: { items: TrialBalanceRow[] } } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/accounting/trial-balance?periodId=${encodeURIComponent(periodId)}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: TrialBalanceRow[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

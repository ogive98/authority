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

export type AccJournalEntryLine = {
  id: string;
  accountId: string;
  accountCode: string | null;
  accountName: string | null;
  debit: string;
  credit: string;
  memo: string | null;
  lineNo: number;
};

export type AccJournalEntry = {
  id: string;
  number: string;
  status: string;
  entryDate: string;
  description: string | null;
  journalCode: string | null;
  periodCode: string | null;
  sourceType: string | null;
  sourceId: string | null;
  lines: AccJournalEntryLine[];
};

/** Pref keys for Finance→GL mapping (D179/D193). */
export const GL_MAPPING_KEYS = {
  ar: "accounting.gl.ar",
  bank: "accounting.gl.bank",
  revenue: "accounting.gl.revenue",
  vat: "accounting.gl.vat",
  bankFee: "accounting.gl.bank_fee",
  salesJournal: "accounting.gl.sales_journal",
  bankJournal: "accounting.gl.bank_journal",
} as const;

export const GL_MAPPING_DEFAULTS = {
  ar: "411",
  bank: "512",
  revenue: "701",
  vat: "4367",
  /** Empty until human Prefs — never invent fee CoA. */
  bankFee: "",
  salesJournal: "VEN",
  bankJournal: "BQ",
} as const;

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

export async function updatePeriodStatus(
  periodId: string,
  status: "OPEN" | "SOFT_CLOSED" | "CLOSED" | "LOCKED",
): Promise<{ ok: true; data: AccPeriod } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/accounting/periods/${encodeURIComponent(periodId)}/status`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AccPeriod };
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

export async function fetchEntries(opts?: {
  periodId?: string;
  status?: string;
  limit?: number;
}): Promise<{ ok: true; data: { items: AccJournalEntry[] } } | ApiFail> {
  try {
    const q = new URLSearchParams();
    if (opts?.periodId) q.set("periodId", opts.periodId);
    if (opts?.status) q.set("status", opts.status);
    if (opts?.limit) q.set("limit", String(opts.limit));
    const res = await fetch(
      `/api/v1/accounting/entries${q.size ? `?${q}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: AccJournalEntry[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchGlMapping(): Promise<
  {
    ok: true;
    data: {
      codes: {
        ar: string;
        bank: string;
        revenue: string;
        vat: string;
        bankFee: string;
        salesJournal: string;
        bankJournal: string;
      };
    };
  } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/accounting/gl-mapping", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        codes: {
          ar: string;
          bank: string;
          revenue: string;
          vat: string;
          bankFee: string;
          salesJournal: string;
          bankJournal: string;
        };
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function postEntry(
  id: string,
): Promise<{ ok: true; data: AccJournalEntry } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/accounting/entries/${encodeURIComponent(id)}/post`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AccJournalEntry };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function reverseEntry(
  id: string,
): Promise<{ ok: true; data: AccJournalEntry } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/accounting/entries/${encodeURIComponent(id)}/reverse`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as AccJournalEntry };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function deaccountInvoice(
  invoiceId: string,
): Promise<
  | {
      ok: true;
      data: {
        outcome: string;
        entryId?: string;
        number?: string;
        reason?: string;
      };
    }
  | ApiFail
> {
  try {
    const res = await fetch(
      `/api/v1/accounting/deaccount/invoice/${encodeURIComponent(invoiceId)}`,
      {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        outcome: string;
        entryId?: string;
        number?: string;
        reason?: string;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

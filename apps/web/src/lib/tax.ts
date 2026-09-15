export type TaxCode = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  kind: string;
  calcMethod?: string;
  status?: string;
  active: boolean;
  currentRateBps: number | null;
  currentAmountMilli?: number | null;
  unit?: string | null;
  lawRef: string | null;
};

export type TaxRate = {
  id: string;
  companyId: string;
  taxCodeId: string;
  taxCode: string;
  rateBps: number;
  ratePercent: string;
  validFrom: string;
  validTo: string | null;
  lawRef: string | null;
  expertValidatedAt: string | null;
};

type ApiFail = { ok: false; status: number; code?: string; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
  };
  return {
    ok: false,
    status: res.status,
    code: body.code,
    message: body.message ?? res.statusText,
  };
}

export async function fetchTaxCodes(): Promise<
  { ok: true; data: { items: TaxCode[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/tax/codes", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: TaxCode[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchTaxRates(): Promise<
  { ok: true; data: { items: TaxRate[] } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/tax/rates", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: TaxRate[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type TejExport = {
  id: string;
  companyId: string;
  periodLabel: string;
  contentSha256: string;
  prefsValueLabel: string;
  lawRef: string | null;
  schemaNote: string;
  transmission: "DISABLED";
  xmlContent?: string;
  createdAt: string;
};

export async function fetchTejExports(): Promise<
  | { ok: true; data: { items: TejExport[]; transmission: "DISABLED" } }
  | ApiFail
> {
  try {
    const res = await fetch("/api/v1/tax/tej/exports", {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: TejExport[];
        transmission: "DISABLED";
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function generateTejExport(
  periodLabel: string,
): Promise<{ ok: true; data: TejExport } | ApiFail> {
  try {
    const res = await fetch("/api/v1/tax/tej/exports", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ periodLabel }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TejExport };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchTejExport(
  id: string,
): Promise<{ ok: true; data: TejExport } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/tej/exports/${id}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TejExport };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export function downloadTejXml(exportRow: TejExport): void {
  if (!exportRow.xmlContent) return;
  const blob = new Blob([exportRow.xmlContent], {
    type: "application/xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tej-local-${exportRow.periodLabel}-${exportRow.contentSha256.slice(0, 8)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

export function formatRateBps(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(0)} %`;
}

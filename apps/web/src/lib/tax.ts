export type TaxCode = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  kind: "VAT";
  active: boolean;
  currentRateBps: number | null;
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

export function formatRateBps(bps: number | null): string {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(0)} %`;
}

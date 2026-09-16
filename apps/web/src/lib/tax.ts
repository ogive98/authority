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

/** D282 — RAS withholding + TEJ Center hub. */
export type TaxWithholdingStatus =
  | "DETECTED"
  | "CALCULATED"
  | "VALIDATED"
  | "CERTIFICATE_READY"
  | "TEJ_PREPARED"
  | "TRANSMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "ARCHIVED";

export type TaxWithholding = {
  id: string;
  companyId: string;
  status: TaxWithholdingStatus;
  applicable: boolean | null;
  decisionCode: string;
  decisionReason: string;
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  vendorName: string;
  baseAmount: string;
  rateBps: number | null;
  withholdingAmount: string;
  netPayable: string | null;
  currency: string;
  lawRef: string | null;
  periodLabel: string | null;
  isStubRate: boolean;
  prefsSnapshot: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RasDetectResult = {
  applicable: boolean | null;
  decisionCode: string;
  decisionReason: string;
  baseAmount: string;
  rateBps: number | null;
  withholdingAmount: string;
  netPayable: string | null;
  lawRef: string | null;
  isStubRate: boolean;
  prefsSnapshot: Record<string, unknown>;
};

export type TejCenterOverview = {
  periodLabel: string;
  architecture: {
    module: "tax";
    domain: "RAS";
    surface: "TEJ_CENTER";
    transmission: "DISABLED";
    xmlMode: string;
  };
  withholdings: {
    total: number;
    byStatus: Record<string, number>;
    needingValidation: number;
    validated: number;
    stubBlocked: number;
    amountWithheldValidated: string;
  };
  tejExports: {
    localDrafts: number;
    transmission: "DISABLED";
  };
};

export async function fetchTejCenterOverview(
  periodLabel?: string,
): Promise<{ ok: true; data: TejCenterOverview } | ApiFail> {
  try {
    const q =
      periodLabel?.trim() != null && periodLabel.trim() !== ""
        ? `?periodLabel=${encodeURIComponent(periodLabel.trim())}`
        : "";
    const res = await fetch(`/api/v1/tax/tej-center/overview${q}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TejCenterOverview };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchTaxWithholdings(opts?: {
  status?: string;
  periodLabel?: string;
}): Promise<{ ok: true; data: { items: TaxWithholding[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.periodLabel) params.set("periodLabel", opts.periodLabel);
    const q = params.toString() ? `?${params}` : "";
    const res = await fetch(`/api/v1/tax/withholdings${q}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { items: TaxWithholding[] },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function detectRas(input: {
  baseAmount: number;
  vendorName: string;
  periodLabel?: string;
  currency?: string;
}): Promise<{ ok: true; data: RasDetectResult } | ApiFail> {
  try {
    const res = await fetch("/api/v1/tax/withholdings/detect", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as RasDetectResult };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createTaxWithholding(input: {
  baseAmount: number;
  vendorName: string;
  periodLabel?: string;
  currency?: string;
}): Promise<{ ok: true; data: TaxWithholding } | ApiFail> {
  try {
    const res = await fetch("/api/v1/tax/withholdings", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TaxWithholding };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function validateTaxWithholding(
  id: string,
): Promise<{ ok: true; data: TaxWithholding } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/validate`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TaxWithholding };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export const WH_STATUS_LABELS: Record<TaxWithholdingStatus, string> = {
  DETECTED: "Détectée",
  CALCULATED: "Calculée",
  VALIDATED: "Validée",
  CERTIFICATE_READY: "Certificat prêt",
  TEJ_PREPARED: "TEJ préparé",
  TRANSMITTED: "Transmis (local)",
  ACCEPTED: "Acceptée",
  REJECTED: "Rejetée",
  ARCHIVED: "Archivée",
};

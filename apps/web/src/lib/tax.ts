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
  /** D293 — e.g. AUTHORITY_LOCAL_DRAFT@1 */
  schemaVersion?: string;
  transmission: "DISABLED";
  packKind?: "META_DRAFT" | "WITHHOLDING_PACK";
  withholdingCount?: number;
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

/** D285 — pack CERTIFICATE_READY → local XML (no transmission). */
export async function generateTejPack(
  periodLabel: string,
  side?: "AP" | "AR",
): Promise<{ ok: true; data: TejExport } | ApiFail> {
  try {
    const res = await fetch("/api/v1/tax/tej/packs", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ periodLabel, ...(side ? { side } : {}) }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TejExport };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

/** D286 — pack XML for one AR invoice. */
export async function generateTejInvoicePack(
  arInvoiceId: string,
): Promise<{ ok: true; data: TejExport } | ApiFail> {
  try {
    const res = await fetch("/api/v1/tax/tej/packs/invoice", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ arInvoiceId }),
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
  side?: "AP" | "AR";
  supplierId: string | null;
  apBillId: string | null;
  apPaymentId: string | null;
  arInvoiceId?: string | null;
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
  certificateSha256?: string | null;
  certificateAt?: string | null;
  certificateNumber?: string | null;
  tejExportId?: string | null;
  tejImportAckAt?: string | null;
  tejImportNote?: string | null;
  tejRejectReason?: string | null;
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
    bySide?: { AP: number; AR: number };
    needingValidation: number;
    validated: number;
    certificateReady: number;
    tejPrepared: number;
    awaitingImportAck?: number;
    transmitted?: number;
    accepted?: number;
    rejected?: number;
    stubBlocked: number;
    amountWithheldValidated: string;
  };
  tejExports: {
    localDrafts: number;
    packs: number;
    transmission: "DISABLED";
    recent?: Array<{
      id: string;
      periodLabel: string;
      packKind: string;
      withholdingCount: number;
      contentSha256: string;
      createdAt: string;
    }>;
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
  side?: "AP" | "AR";
  arInvoiceId?: string;
}): Promise<{ ok: true; data: { items: TaxWithholding[] } } | ApiFail> {
  try {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.periodLabel) params.set("periodLabel", opts.periodLabel);
    if (opts?.side) params.set("side", opts.side);
    if (opts?.arInvoiceId) params.set("arInvoiceId", opts.arInvoiceId);
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

/** D287 — local Tej import ack (no AUTHORITY upload). */
export async function ackTejImport(
  id: string,
  note?: string,
): Promise<{ ok: true; data: TaxWithholding } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/tej-import-ack`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(note?.trim() ? { note: note.trim() } : {}),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as TaxWithholding };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function recordTejResult(
  id: string,
  input: {
    result: "ACCEPTED" | "REJECTED";
    note?: string;
    rejectReason?: string;
  },
): Promise<{ ok: true; data: TaxWithholding } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/tej-result`, {
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

export async function archiveTaxWithholding(
  id: string,
): Promise<{ ok: true; data: TaxWithholding } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/archive`, {
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
  TRANSMITTED: "Import Tej (accusé)",
  ACCEPTED: "Acceptée Tej",
  REJECTED: "Rejetée Tej",
  ARCHIVED: "Archivée",
};

export type RasCertificate = {
  withholdingId: string;
  status: TaxWithholdingStatus;
  schemaNote: string;
  contentSha256: string;
  certificateNumber?: string | null;
  generatedAt: string;
  body: string;
  withholding: TaxWithholding;
};

export async function generateRasCertificate(
  id: string,
): Promise<{ ok: true; data: RasCertificate } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/certificate`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as RasCertificate };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchRasCertificate(
  id: string,
): Promise<{ ok: true; data: RasCertificate } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/tax/withholdings/${id}/certificate`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as RasCertificate };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export function downloadRasCertificate(cert: RasCertificate): void {
  const blob = new Blob([cert.body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug =
    cert.certificateNumber?.replace(/[^a-zA-Z0-9-]/g, "") ||
    cert.withholdingId.slice(0, 8);
  a.download = `ras-certificat-${slug}-${cert.contentSha256.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

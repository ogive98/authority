/** Client helpers for HR (`/api/v1/hr`). */

export type HrContract = {
  id: string;
  employeeId: string;
  number: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string | null;
  wageRef: string | null;
  wageBase: string | null;
  notes: string | null;
  pdfDocumentId?: string | null;
};

export type HrContractPrintTemplate = {
  letterhead: string;
  bodyHtml: string;
  footer: string;
};

export type HrAttestationPrintTemplate = HrContractPrintTemplate;

export type HrPrintDocKind = "CONTRACT" | "ATTESTATION";

export type HrPrintTemplate = {
  id: string;
  companyId: string;
  kind: HrPrintDocKind;
  code: string;
  name: string;
  letterhead: string;
  bodyHtml: string;
  footer: string;
  active: boolean;
};

export type HrLinkedUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
};

export type HrLinkableUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  roleCode: string | null;
  linkedEmployeeId: string | null;
};

export type HrSite = {
  id: string;
  code: string;
  type: string;
  status: string;
};

export type HrEmployee = {
  id: string;
  companyId?: string;
  matricule: string;
  displayName: string;
  siteId: string | null;
  site: HrSite | null;
  department: string | null;
  jobTitleId: string | null;
  jobTitle: string | null;
  cnssNo: string | null;
  cinNo: string | null;
  address: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  email: string | null;
  userId: string | null;
  linkedUser: HrLinkedUser | null;
  status: string;
  hiredAt: string | null;
  leftAt: string | null;
  notes: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  photoDocumentId: string | null;
  attestationPdfDocumentId: string | null;
  contracts: HrContract[];
  createdAt: string;
};

export function hrEmployeeDocumentContentHref(
  employeeId: string,
  documentId: string,
): string {
  return `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/content`;
}

export function isHrImageMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
    mime.toLowerCase(),
  );
}

export function isHrPreviewableMime(mime: string | undefined | null): boolean {
  if (!mime) return false;
  const m = mime.toLowerCase();
  return isHrImageMime(m) || m === "application/pdf";
}

export type CnssPreview = {
  contractId: string;
  employeeId: string;
  periodYm: string;
  wageBase: number;
  assiette: number;
  ceilingApplied: boolean;
  ceilingAmount: number | null;
  employeeRateBps: number | null;
  employerRateBps: number | null;
  employeeAmount: number | null;
  employerAmount: number | null;
  ready: boolean;
  pending: string[];
  prefsHref: string;
  currency: string;
};

export type CnssSnapshot = {
  id: string;
  periodYm: string;
  contractId: string;
  employeeId: string;
  wageBase: string;
  assiette: string;
  employeeAmount: string | null;
  employerAmount: string | null;
  ceilingApplied: boolean;
};

type ApiFail = { ok: false; status: number; message: string };
type ApiOk<T> = { ok: true; data: T };

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

export async function fetchEmployees(
  q?: string,
  status?: string,
): Promise<ApiOk<{ items: HrEmployee[] }> | ApiFail> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const qs = params.toString();
  const res = await fetch(
    qs ? `/api/v1/hr/employees?${qs}` : "/api/v1/hr/employees",
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: HrEmployee[] } };
}

export async function fetchEmployee(
  id: string,
): Promise<ApiOk<HrEmployee> | ApiFail> {
  const res = await fetch(`/api/v1/hr/employees/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrEmployee };
}

export type HrJobTitle = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type HrDocKind = {
  id: string;
  code: string;
  name: string;
  active: boolean;
};

export type HrEmployeeDocument = {
  id: string;
  number: string;
  title: string;
  mime: string;
  size: string;
  hrDocKindId?: string | null;
  hrDocKind?: { id: string; code: string; name: string } | null;
  createdAt: string;
};

export async function fetchJobTitles(
  activeOnly = false,
): Promise<ApiOk<{ items: HrJobTitle[] }> | ApiFail> {
  const qs = activeOnly ? "?activeOnly=1" : "";
  const res = await fetch(`/api/v1/hr/job-titles${qs}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: HrJobTitle[] } };
}

export async function createJobTitle(input: {
  code: string;
  name: string;
}): Promise<ApiOk<HrJobTitle> | ApiFail> {
  const res = await fetch("/api/v1/hr/job-titles", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrJobTitle };
}

export async function patchJobTitle(
  id: string,
  input: { code?: string; name?: string; active?: boolean },
): Promise<ApiOk<HrJobTitle> | ApiFail> {
  const res = await fetch(`/api/v1/hr/job-titles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrJobTitle };
}

export async function fetchDocKinds(
  activeOnly = false,
): Promise<ApiOk<{ items: HrDocKind[] }> | ApiFail> {
  const qs = activeOnly ? "?activeOnly=1" : "";
  const res = await fetch(`/api/v1/hr/doc-kinds${qs}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: HrDocKind[] } };
}

export async function createDocKind(input: {
  code: string;
  name: string;
}): Promise<ApiOk<HrDocKind> | ApiFail> {
  const res = await fetch("/api/v1/hr/doc-kinds", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrDocKind };
}

export async function patchDocKind(
  id: string,
  input: { code?: string; name?: string; active?: boolean },
): Promise<ApiOk<HrDocKind> | ApiFail> {
  const res = await fetch(`/api/v1/hr/doc-kinds/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrDocKind };
}

export async function fetchEmployeeDocuments(
  employeeId: string,
): Promise<ApiOk<{ items: HrEmployeeDocument[] }> | ApiFail> {
  const res = await fetch(
    `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/documents`,
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return {
    ok: true,
    data: (await res.json()) as { items: HrEmployeeDocument[] },
  };
}

export async function uploadEmployeeDocument(
  employeeId: string,
  file: File,
  opts?: { title?: string; kindId?: string },
): Promise<ApiOk<HrEmployeeDocument> | ApiFail> {
  const body = new FormData();
  body.append("file", file);
  if (opts?.title?.trim()) body.append("title", opts.title.trim());
  if (opts?.kindId) body.append("kindId", opts.kindId);
  const res = await fetch(
    `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/documents`,
    { method: "POST", credentials: "include", body },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrEmployeeDocument };
}

export async function uploadEmployeePhoto(
  employeeId: string,
  file: File,
): Promise<ApiOk<HrEmployee> | ApiFail> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(
    `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/photo`,
    { method: "POST", credentials: "include", body },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrEmployee };
}

export async function downloadEmployeeDocument(
  employeeId: string,
  documentId: string,
): Promise<{ ok: true } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(documentId)}/download`,
      { credentials: "include" },
    );
    if (!res.ok) {
      return { ok: false, status: res.status, message: await parseError(res) };
    }
    const body = (await res.json()) as { downloadUrl?: string };
    if (!body.downloadUrl) {
      return { ok: false, status: 500, message: "URL de téléchargement absente." };
    }
    window.open(body.downloadUrl, "_blank", "noopener,noreferrer");
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createEmployee(input: {
  matricule: string;
  displayName: string;
  department?: string;
  jobTitleId?: string;
  cnssNo?: string;
  cinNo?: string;
  address?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  email?: string;
  hiredAt?: string;
}): Promise<ApiOk<HrEmployee> | ApiFail> {
  const res = await fetch("/api/v1/hr/employees", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrEmployee };
}

export async function createContract(input: {
  employeeId: string;
  type: string;
  startDate: string;
  endDate?: string;
  wageRef?: string;
  wageBase?: number;
}): Promise<ApiOk<HrContract> | ApiFail> {
  const res = await fetch("/api/v1/hr/contracts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrContract };
}

export async function patchContract(
  id: string,
  input: {
    type?: string;
    startDate?: string;
    endDate?: string | null;
    wageRef?: string | null;
    wageBase?: number | null;
    notes?: string | null;
  },
): Promise<ApiOk<HrContract> | ApiFail> {
  const res = await fetch(`/api/v1/hr/contracts/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrContract };
}

export async function downloadContractPdf(
  id: string,
  opts?: {
    templateId?: string;
    letterhead?: string;
    bodyHtml?: string;
    footer?: string;
  },
): Promise<{ ok: true } | ApiFail> {
  try {
    const hasBody =
      opts &&
      (opts.letterhead !== undefined ||
        opts.bodyHtml !== undefined ||
        opts.footer !== undefined ||
        opts.templateId);
    const res = hasBody
      ? await fetch(`/api/v1/hr/contracts/${encodeURIComponent(id)}/pdf`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/pdf",
          },
          body: JSON.stringify({
            templateId: opts?.templateId,
            letterhead: opts?.letterhead,
            bodyHtml: opts?.bodyHtml,
            footer: opts?.footer,
          }),
        })
      : await fetch(`/api/v1/hr/contracts/${encodeURIComponent(id)}/pdf`, {
          credentials: "include",
        });
    if (!res.ok) {
      return { ok: false, status: res.status, message: await parseError(res) };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
      `contrat-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function downloadAttestationPdf(
  employeeId: string,
  opts?: {
    templateId?: string;
    letterhead?: string;
    bodyHtml?: string;
    footer?: string;
  },
): Promise<{ ok: true } | ApiFail> {
  try {
    const hasBody =
      opts &&
      (opts.letterhead !== undefined ||
        opts.bodyHtml !== undefined ||
        opts.footer !== undefined ||
        opts.templateId);
    const res = hasBody
      ? await fetch(
          `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/attestation/pdf`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/pdf",
            },
            body: JSON.stringify({
              templateId: opts?.templateId,
              letterhead: opts?.letterhead,
              bodyHtml: opts?.bodyHtml,
              footer: opts?.footer,
            }),
          },
        )
      : await fetch(
          `/api/v1/hr/employees/${encodeURIComponent(employeeId)}/attestation/pdf`,
          { credentials: "include" },
        );
    if (!res.ok) {
      return { ok: false, status: res.status, message: await parseError(res) };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
      `attestation-${employeeId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

/** Expand {{placeholders}} for free-edit drawers before PDF. */
export function applyHrPrintPlaceholders(
  template: string,
  fields: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (_, key: string) => {
    return fields[key] ?? "";
  });
}

export async function fetchContractPrintTemplate(): Promise<
  ApiOk<HrContractPrintTemplate> | ApiFail
> {
  const res = await fetch("/api/v1/hr/contract-print-template", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrContractPrintTemplate };
}

export async function putContractPrintTemplate(
  input: Partial<HrContractPrintTemplate>,
): Promise<ApiOk<HrContractPrintTemplate> | ApiFail> {
  const res = await fetch("/api/v1/hr/contract-print-template", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrContractPrintTemplate };
}

export async function fetchAttestationPrintTemplate(): Promise<
  ApiOk<HrAttestationPrintTemplate> | ApiFail
> {
  const res = await fetch("/api/v1/hr/attestation-print-template", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrAttestationPrintTemplate };
}

export async function putAttestationPrintTemplate(
  input: Partial<HrAttestationPrintTemplate>,
): Promise<ApiOk<HrAttestationPrintTemplate> | ApiFail> {
  const res = await fetch("/api/v1/hr/attestation-print-template", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrAttestationPrintTemplate };
}

export async function fetchPrintTemplates(opts?: {
  kind?: HrPrintDocKind;
  activeOnly?: boolean;
}): Promise<ApiOk<{ items: HrPrintTemplate[] }> | ApiFail> {
  const qs = new URLSearchParams();
  if (opts?.kind) qs.set("kind", opts.kind);
  if (opts?.activeOnly) qs.set("activeOnly", "1");
  const q = qs.toString();
  const res = await fetch(`/api/v1/hr/print-templates${q ? `?${q}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return {
    ok: true,
    data: (await res.json()) as { items: HrPrintTemplate[] },
  };
}

export async function createPrintTemplate(input: {
  kind: HrPrintDocKind;
  code: string;
  name: string;
  letterhead?: string;
  bodyHtml?: string;
  footer?: string;
}): Promise<ApiOk<HrPrintTemplate> | ApiFail> {
  const res = await fetch("/api/v1/hr/print-templates", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrPrintTemplate };
}

export async function patchPrintTemplate(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    letterhead: string;
    bodyHtml: string;
    footer: string;
    active: boolean;
  }>,
): Promise<ApiOk<HrPrintTemplate> | ApiFail> {
  const res = await fetch(
    `/api/v1/hr/print-templates/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrPrintTemplate };
}

export async function endContract(
  id: string,
  endDate?: string,
): Promise<ApiOk<HrContract> | ApiFail> {
  const res = await fetch(`/api/v1/hr/contracts/${id}/end`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ endDate }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrContract };
}

export type LevyLinePreview = {
  slotKey: string;
  rateBps: number | null;
  amount: number | null;
  lawRef: string | null;
  pending: string[];
  ready: boolean;
};

export type LevyPreview = {
  contractId: string;
  employeeId: string;
  wageBase: number;
  tfp: LevyLinePreview;
  foprolos: LevyLinePreview;
  ready: boolean;
  pending: string[];
  prefsHref: string;
  currency: string;
  note: string;
};

export async function fetchLevyPreview(
  contractId: string,
): Promise<ApiOk<LevyPreview> | ApiFail> {
  const params = new URLSearchParams({ contractId });
  const res = await fetch(`/api/v1/hr/levies/preview?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as LevyPreview };
}

export async function fetchCnssPreview(
  contractId: string,
  periodYm?: string,
): Promise<ApiOk<CnssPreview> | ApiFail> {
  const params = new URLSearchParams({ contractId });
  if (periodYm) params.set("periodYm", periodYm);
  const res = await fetch(`/api/v1/hr/cnss/preview?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as CnssPreview };
}

export async function createCnssSnapshot(input: {
  contractId: string;
  periodYm?: string;
}): Promise<ApiOk<CnssSnapshot> | ApiFail> {
  const res = await fetch("/api/v1/hr/cnss/snapshots", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as CnssSnapshot };
}

export type IrppPreview = {
  contractId: string;
  employeeId: string;
  periodYm: string;
  wageBase: number;
  cnssEmployeeAmount: number | null;
  taxableMonthly: number | null;
  annualTaxableBeforeAbat: number | null;
  annualTaxable: number | null;
  annualIrpp: number | null;
  monthlyIrpp: number | null;
  abatChefAnnual: number;
  abatEnfantAnnual: number;
  abatTotalAnnual: number;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  ready: boolean;
  pending: string[];
  prefsHref: string;
  methodNote: string;
  currency: string;
};

export type IrppSnapshot = {
  id: string;
  periodYm: string;
  contractId: string;
  monthlyIrpp: string;
  annualIrpp: string;
  taxableMonthly: string;
};

export type IrppBracket = {
  id?: string;
  sortOrder?: number;
  upToMilli: number | null;
  rateBps: number;
  lawRef: string | null;
};

export async function fetchIrppPreview(
  contractId: string,
  periodYm?: string,
): Promise<ApiOk<IrppPreview> | ApiFail> {
  const params = new URLSearchParams({ contractId });
  if (periodYm) params.set("periodYm", periodYm);
  const res = await fetch(`/api/v1/hr/irpp/preview?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as IrppPreview };
}

export async function createIrppSnapshot(input: {
  contractId: string;
  periodYm?: string;
}): Promise<ApiOk<IrppSnapshot> | ApiFail> {
  const res = await fetch("/api/v1/hr/irpp/snapshots", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as IrppSnapshot };
}

export async function fetchIrppBrackets(): Promise<
  ApiOk<{ items: IrppBracket[] }> | ApiFail
> {
  const res = await fetch("/api/v1/hr/irpp/brackets", {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: IrppBracket[] } };
}

export async function replaceIrppBrackets(
  brackets: Array<{
    upToMilli: number | null;
    rateBps: number;
    lawRef?: string | null;
  }>,
): Promise<ApiOk<{ items: IrppBracket[] }> | ApiFail> {
  const res = await fetch("/api/v1/hr/irpp/brackets", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ brackets }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: IrppBracket[] } };
}

export type BulletinPreview = {
  contractId: string;
  employeeId: string;
  employeeName: string;
  matricule: string;
  contractNumber: string;
  periodYm: string;
  wageBase: number | null;
  cnssEmployeeAmount: number | null;
  cnssEmployerAmount: number | null;
  irppMonthly: number | null;
  netPay: number | null;
  ready: boolean;
  pending: string[];
  currency: string;
};

export type Bulletin = {
  id: string;
  number: string;
  periodYm: string;
  employeeId: string;
  contractId: string;
  wageBase: string;
  cnssEmployeeAmount: string;
  cnssEmployerAmount: string;
  irppMonthly: string;
  netPay: string;
  currency: string;
  pdfDocumentId: string | null;
  employeeName: string | null;
  matricule: string | null;
  contractNumber: string | null;
  annualTaxableBeforeAbat: string | null;
  abatChefAnnual: string | null;
  abatEnfantAnnual: string | null;
  abatTotalAnnual: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  createdAt: string;
};

export async function fetchBulletinPreview(
  contractId: string,
  periodYm?: string,
): Promise<ApiOk<BulletinPreview> | ApiFail> {
  const params = new URLSearchParams({ contractId });
  if (periodYm) params.set("periodYm", periodYm);
  const res = await fetch(`/api/v1/hr/bulletins/preview?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as BulletinPreview };
}

export async function fetchBulletins(opts?: {
  periodYm?: string;
  limit?: number;
}): Promise<ApiOk<{ items: Bulletin[] }> | ApiFail> {
  const params = new URLSearchParams();
  if (opts?.periodYm) params.set("periodYm", opts.periodYm);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const res = await fetch(
    qs ? `/api/v1/hr/bulletins?${qs}` : "/api/v1/hr/bulletins",
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { items: Bulletin[] } };
}

export async function fetchBulletin(
  id: string,
): Promise<ApiOk<Bulletin> | ApiFail> {
  const res = await fetch(`/api/v1/hr/bulletins/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Bulletin };
}

export async function createBulletin(input: {
  contractId: string;
  periodYm?: string;
}): Promise<ApiOk<Bulletin> | ApiFail> {
  const res = await fetch("/api/v1/hr/bulletins", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as Bulletin };
}

export async function fetchLinkableUsers(
  q?: string,
): Promise<ApiOk<{ items: HrLinkableUser[] }> | ApiFail> {
  const qs = q?.trim()
    ? `?q=${encodeURIComponent(q.trim())}`
    : "";
  const res = await fetch(`/api/v1/hr/linkable-users${qs}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return {
    ok: true,
    data: (await res.json()) as { items: HrLinkableUser[] },
  };
}

export async function patchEmployee(
  id: string,
  input: {
    displayName?: string;
    department?: string | null;
    jobTitleId?: string | null;
    cnssNo?: string | null;
    cinNo?: string | null;
    address?: string | null;
    bankName?: string | null;
    bankAgency?: string | null;
    bankAccount?: string | null;
    email?: string | null;
    status?: string;
    hiredAt?: string | null;
    leftAt?: string | null;
    notes?: string | null;
    taxChefDeFamille?: boolean | null;
    taxEnfantCount?: number | null;
    photoDocumentId?: string | null;
    userId?: string | null;
    siteId?: string | null;
  },
): Promise<ApiOk<HrEmployee> | ApiFail> {
  const res = await fetch(`/api/v1/hr/employees/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as HrEmployee };
}

/** Download server PDF (stream + Documents persist). */
export async function downloadBulletinPdf(
  id: string,
): Promise<{ ok: true } | ApiFail> {
  try {
    const res = await fetch(
      `/api/v1/hr/bulletins/${encodeURIComponent(id)}/pdf`,
      { credentials: "include" },
    );
    if (!res.ok) {
      return { ok: false, status: res.status, message: await parseError(res) };
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      res.headers.get("Content-Disposition")?.match(/filename="?([^"]+)"?/)?.[1] ??
      `bulletin-${id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

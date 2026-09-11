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
};

export type HrEmployee = {
  id: string;
  matricule: string;
  displayName: string;
  department: string | null;
  jobTitle: string | null;
  cnssNo: string | null;
  email: string | null;
  status: string;
  hiredAt: string | null;
  leftAt: string | null;
  notes: string | null;
  contracts: HrContract[];
  createdAt: string;
};

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

export async function createEmployee(input: {
  matricule: string;
  displayName: string;
  department?: string;
  jobTitle?: string;
  cnssNo?: string;
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
  input: { wageRef?: string | null; wageBase?: number | null },
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
  annualTaxable: number | null;
  annualIrpp: number | null;
  monthlyIrpp: number | null;
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

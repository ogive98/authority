/** Client helpers for HR light (`/api/v1/hr`). */

export type HrContract = {
  id: string;
  employeeId: string;
  number: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string | null;
  wageRef: string | null;
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

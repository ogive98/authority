/** Client helpers for Attendance leave (`/api/v1/attendance`). */

export type AttAbsenceType = "PAID" | "UNPAID" | "OTHER";
export type AttAbsenceStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type AttAbsence = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeMatricule: string | null;
  employeeDisplayName: string | null;
  type: AttAbsenceType;
  status: AttAbsenceStatus;
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  requestedByUserId: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
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

export async function fetchAbsences(opts?: {
  status?: AttAbsenceStatus;
  employeeId?: string;
}): Promise<ApiOk<AttAbsence[]> | ApiFail> {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.employeeId) params.set("employeeId", opts.employeeId);
  const qs = params.toString();
  const res = await fetch(
    qs ? `/api/v1/attendance/absences?${qs}` : "/api/v1/attendance/absences",
    { credentials: "include" },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttAbsence[] };
}

export async function createAbsence(body: {
  employeeId: string;
  type: AttAbsenceType;
  startDate: string;
  endDate: string;
  reason?: string;
  notes?: string;
}): Promise<ApiOk<AttAbsence> | ApiFail> {
  const res = await fetch("/api/v1/attendance/absences", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttAbsence };
}

export async function approveAbsence(
  id: string,
  notes?: string,
): Promise<ApiOk<AttAbsence> | ApiFail> {
  const res = await fetch(
    `/api/v1/attendance/absences/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notes ? { notes } : {}),
    },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttAbsence };
}

export async function rejectAbsence(
  id: string,
  notes?: string,
): Promise<ApiOk<AttAbsence> | ApiFail> {
  const res = await fetch(
    `/api/v1/attendance/absences/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notes ? { notes } : {}),
    },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttAbsence };
}

export async function cancelAbsence(
  id: string,
): Promise<ApiOk<AttAbsence> | ApiFail> {
  const res = await fetch(
    `/api/v1/attendance/absences/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    },
  );
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttAbsence };
}

export function absenceStatusTone(
  status: AttAbsenceStatus,
): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "REJECTED":
      return "danger";
    case "CANCELLED":
      return "neutral";
    case "REQUESTED":
    default:
      return "warning";
  }
}

export type AttCalendarKind = "LEAVE" | "ABSENCE" | "PENALTY";

export type AttCalendarEntry = {
  id: string;
  source: "absence" | "rh_event";
  kind: AttCalendarKind;
  employeeId: string;
  startDate: string;
  endDate: string;
  motif: string | null;
  type: AttAbsenceType | null;
  status: AttAbsenceStatus | null;
  eventKind: "PENALTY" | null;
};

export async function fetchAttendanceCalendar(opts: {
  employeeId: string;
  from?: string;
  to?: string;
}): Promise<ApiOk<AttCalendarEntry[]> | ApiFail> {
  const params = new URLSearchParams();
  params.set("employeeId", opts.employeeId);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const res = await fetch(`/api/v1/attendance/calendar?${params}`, {
    credentials: "include",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as AttCalendarEntry[] };
}

export async function createRhEvent(body: {
  employeeId: string;
  startDate: string;
  endDate: string;
  motif: string;
  notes?: string;
  kind?: "PENALTY";
}): Promise<ApiOk<{ id: string }> | ApiFail> {
  const res = await fetch("/api/v1/attendance/events", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await parseError(res) };
  }
  return { ok: true, data: (await res.json()) as { id: string } };
}

export function calendarKindTone(
  kind: AttCalendarKind,
): "success" | "danger" | "warning" {
  switch (kind) {
    case "LEAVE":
      return "success";
    case "ABSENCE":
      return "danger";
    case "PENALTY":
    default:
      return "warning";
  }
}

export function calendarKindLabel(kind: AttCalendarKind): string {
  switch (kind) {
    case "LEAVE":
      return "Congé";
    case "ABSENCE":
      return "Absence";
    case "PENALTY":
      return "Pénalité";
  }
}

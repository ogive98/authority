export type FleetVehicleStatus =
  | "ACTIVE"
  | "MAINTENANCE"
  | "OUT"
  | "ARCHIVED";

export type FleetLogKind =
  | "ODOMETER"
  | "OIL_CHANGE"
  | "TIRES"
  | "FUEL"
  | "OTHER";

export const FLEET_VEHICLE_STATUS_LABELS: Record<FleetVehicleStatus, string> = {
  ACTIVE: "Actif",
  MAINTENANCE: "En atelier",
  OUT: "Hors service",
  ARCHIVED: "Archivé",
};

export const FLEET_LOG_KIND_LABELS: Record<FleetLogKind, string> = {
  ODOMETER: "Kilométrage",
  OIL_CHANGE: "Vidange",
  TIRES: "Pneus",
  FUEL: "Carburant",
  OTHER: "Autre",
};

export type FleetVehicle = {
  id: string;
  companyId: string;
  code: string;
  plate: string;
  capacityKg: string | null;
  cold: boolean;
  odometerKm: string | null;
  usualDriverLabel: string | null;
  nextServiceKm: string | null;
  nextServiceAt: string | null;
  serviceDue: boolean;
  status: FleetVehicleStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FleetVehicleLog = {
  id: string;
  companyId: string;
  vehicleId: string;
  kind: FleetLogKind;
  occurredAt: string;
  odometerKm: string | null;
  liters: string | null;
  amountTnd: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FleetAssignment = {
  id: string;
  companyId: string;
  roundId: string;
  vehicleId: string;
  driverLabel: string;
  payloadKg: string | null;
  notes: string | null;
  assignedAt: string;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    code: string;
    plate: string;
    cold: boolean;
    capacityKg: string | null;
    status: FleetVehicleStatus;
  };
  round?: {
    id: string;
    date: string;
    driverLabel: string;
    status: string;
  };
};

export type FleetAssignHints = {
  roundId: string;
  requiresCold: boolean;
  perishableProductCount: number;
};

type ApiFail = { ok: false; status: number; message: string; code?: string };

async function parseFail(res: Response): Promise<ApiFail> {
  let message = res.statusText || "Erreur";
  let code: string | undefined;
  try {
    const body = (await res.json()) as {
      message?: string | string[];
      code?: string;
    };
    if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (typeof body.message === "string") message = body.message;
    if (typeof body.code === "string") code = body.code;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message, code };
}

export async function fetchVehicles(opts?: {
  q?: string;
  status?: FleetVehicleStatus | "";
}): Promise<{ ok: true; data: { items: FleetVehicle[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.q?.trim()) sp.set("q", opts.q.trim());
  if (opts?.status) sp.set("status", opts.status);
  const qs = sp.toString();
  const res = await fetch(`/api/v1/fleet/vehicles${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: FleetVehicle[] },
  };
}

export async function fetchVehicle(
  id: string,
): Promise<{ ok: true; data: FleetVehicle } | ApiFail> {
  const res = await fetch(`/api/v1/fleet/vehicles/${id}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetVehicle };
}

export async function createVehicle(body: {
  code: string;
  plate: string;
  capacityKg?: number;
  cold?: boolean;
  odometerKm?: number;
  usualDriverLabel?: string;
  notes?: string;
}): Promise<{ ok: true; data: FleetVehicle } | ApiFail> {
  const res = await fetch("/api/v1/fleet/vehicles", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetVehicle };
}

export async function updateVehicle(
  id: string,
  body: {
    version: number;
    plate?: string;
    capacityKg?: number | null;
    cold?: boolean;
    odometerKm?: number | null;
    usualDriverLabel?: string | null;
    nextServiceKm?: number | null;
    nextServiceAt?: string | null;
    notes?: string | null;
    status?: FleetVehicleStatus;
  },
): Promise<{ ok: true; data: FleetVehicle } | ApiFail> {
  const res = await fetch(`/api/v1/fleet/vehicles/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetVehicle };
}

export async function fetchVehicleLogs(
  vehicleId: string,
): Promise<{ ok: true; data: { items: FleetVehicleLog[] } } | ApiFail> {
  const res = await fetch(`/api/v1/fleet/vehicles/${vehicleId}/logs`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: FleetVehicleLog[] },
  };
}

export async function createVehicleLog(
  vehicleId: string,
  body: {
    kind: FleetLogKind;
    occurredAt: string;
    odometerKm?: number;
    liters?: number;
    amountTnd?: number;
    notes?: string;
  },
): Promise<
  | { ok: true; data: { log: FleetVehicleLog; vehicle: FleetVehicle } }
  | ApiFail
> {
  const res = await fetch(`/api/v1/fleet/vehicles/${vehicleId}/logs`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as {
      log: FleetVehicleLog;
      vehicle: FleetVehicle;
    },
  };
}

export async function fetchAssignments(opts?: {
  roundId?: string;
  vehicleId?: string;
  includeCancelled?: boolean;
}): Promise<{ ok: true; data: { items: FleetAssignment[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.roundId) sp.set("roundId", opts.roundId);
  if (opts?.vehicleId) sp.set("vehicleId", opts.vehicleId);
  if (opts?.includeCancelled) sp.set("includeCancelled", "1");
  const qs = sp.toString();
  const res = await fetch(`/api/v1/fleet/assignments${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: FleetAssignment[] },
  };
}

export async function fetchAssignHints(
  roundId: string,
): Promise<{ ok: true; data: FleetAssignHints } | ApiFail> {
  const res = await fetch(`/api/v1/fleet/rounds/${roundId}/assign-hints`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetAssignHints };
}

export async function createAssignment(body: {
  roundId: string;
  vehicleId: string;
  driverLabel: string;
  payloadKg?: number;
  notes?: string;
}): Promise<{ ok: true; data: FleetAssignment } | ApiFail> {
  const res = await fetch("/api/v1/fleet/assignments", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetAssignment };
}

export async function cancelAssignment(
  id: string,
): Promise<{ ok: true; data: FleetAssignment } | ApiFail> {
  const res = await fetch(`/api/v1/fleet/assignments/${id}/cancel`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as FleetAssignment };
}

export async function copyAssignmentDriver(
  id: string,
): Promise<
  | {
      ok: true;
      data: { assignment: FleetAssignment; roundDriverLabel: string };
    }
  | ApiFail
> {
  const res = await fetch(`/api/v1/fleet/assignments/${id}/copy-driver`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as {
      assignment: FleetAssignment;
      roundDriverLabel: string;
    },
  };
}

export type ShipmentStatus =
  | "READY"
  | "ASSIGNED"
  | "OUT"
  | "DELIVERED"
  | "FAILED";

export type DeliveryShipment = {
  id: string;
  companyId: string;
  number: string;
  orderId: string;
  orderNumber: string | null;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  status: ShipmentStatus;
  driverLabel: string | null;
  preferredDriver: string | null;
  failReason: string | null;
  version: number;
  assignedAt: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EligibleOrder = {
  id: string;
  number: string;
  customerId: string;
  customerCode: string | null;
  customerName: string | null;
  warehouseId: string;
  warehouseCode: string | null;
  preferredDriver: string | null;
  amountTotal: string;
  confirmedAt: string | null;
  lineCount: number;
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  READY: "Prêt",
  ASSIGNED: "Assigné",
  OUT: "En route",
  DELIVERED: "Livré",
  FAILED: "Échec",
};

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

export async function fetchShipments(opts?: {
  q?: string;
  status?: ShipmentStatus | "";
}): Promise<
  { ok: true; data: { items: DeliveryShipment[]; nextCursor: string | null } } | ApiFail
> {
  try {
    const params = new URLSearchParams();
    if (opts?.q?.trim()) params.set("q", opts.q.trim());
    if (opts?.status) params.set("status", opts.status);
    const qs = params.toString();
    const url = `/api/v1/delivery/shipments${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as {
        items: DeliveryShipment[];
        nextCursor: string | null;
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchEligibleOrders(
  q?: string,
): Promise<{ ok: true; items: EligibleOrder[] } | ApiFail> {
  try {
    const url = q?.trim()
      ? `/api/v1/delivery/eligible-orders?q=${encodeURIComponent(q.trim())}`
      : "/api/v1/delivery/eligible-orders";
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return parseFail(res);
    const body = (await res.json()) as { items: EligibleOrder[] };
    return { ok: true, items: body.items };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function createShipment(body: {
  orderId: string;
  driverLabel?: string;
}): Promise<{ ok: true; data: DeliveryShipment } | ApiFail> {
  try {
    const res = await fetch("/api/v1/delivery/shipments", {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DeliveryShipment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function assignShipmentDriver(
  id: string,
  driverLabel: string,
): Promise<{ ok: true; data: DeliveryShipment } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/delivery/shipments/${id}/assign`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ driverLabel }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DeliveryShipment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function dispatchShipment(
  id: string,
): Promise<{ ok: true; data: DeliveryShipment } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/delivery/shipments/${id}/dispatch`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DeliveryShipment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function completeShipment(
  id: string,
): Promise<{ ok: true; data: DeliveryShipment } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/delivery/shipments/${id}/complete`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DeliveryShipment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function failShipment(
  id: string,
  reason?: string,
): Promise<{ ok: true; data: DeliveryShipment } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/delivery/shipments/${id}/fail`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: (await res.json()) as DeliveryShipment };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

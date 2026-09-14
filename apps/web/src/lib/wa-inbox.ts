export type WaInboxStatus =
  | "OPEN"
  | "MATCHED"
  | "DRAFT_CREATED"
  | "DISMISSED";

export const WA_INBOX_STATUS_LABELS: Record<WaInboxStatus, string> = {
  OPEN: "Ouvert",
  MATCHED: "Client lié",
  DRAFT_CREATED: "Brouillon créé",
  DISMISSED: "Ignoré",
};

export type WaInboxItem = {
  id: string;
  companyId: string;
  wamid: string;
  fromPhone: string;
  profileName: string | null;
  bodyText: string | null;
  messageType: string;
  contactId: string | null;
  customerId: string | null;
  customerCode: string | null;
  customerName: string | null;
  status: WaInboxStatus;
  orderId: string | null;
  orderNumber: string | null;
  receivedAt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ApiFail = { ok: false; status: number; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  let message = res.statusText || "Erreur";
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) message = body.message.join(", ");
    else if (typeof body.message === "string") message = body.message;
  } catch {
    /* ignore */
  }
  return { ok: false, status: res.status, message };
}

export async function fetchWaInbox(opts?: {
  status?: WaInboxStatus | "";
}): Promise<{ ok: true; data: { items: WaInboxItem[] } } | ApiFail> {
  const sp = new URLSearchParams();
  if (opts?.status) sp.set("status", opts.status);
  const qs = sp.toString();
  const res = await fetch(`/api/v1/sales/wa-inbox${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as { items: WaInboxItem[] },
  };
}

export async function matchWaInbox(
  id: string,
  body: { version: number; customerId: string; contactId?: string },
): Promise<{ ok: true; data: WaInboxItem } | ApiFail> {
  const res = await fetch(`/api/v1/sales/wa-inbox/${id}/match`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as WaInboxItem };
}

export async function dismissWaInbox(
  id: string,
  body: { version: number },
): Promise<{ ok: true; data: WaInboxItem } | ApiFail> {
  const res = await fetch(`/api/v1/sales/wa-inbox/${id}/dismiss`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return { ok: true, data: (await res.json()) as WaInboxItem };
}

export async function createWaInboxDraft(
  id: string,
  body: {
    version: number;
    warehouseId: string;
    lines: Array<{ productId: string; qty: number; unitPrice: number }>;
    notes?: string;
  },
): Promise<
  | {
      ok: true;
      data: { message: WaInboxItem; order: { id: string; number: string } };
    }
  | ApiFail
> {
  const res = await fetch(`/api/v1/sales/wa-inbox/${id}/draft-order`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as {
      message: WaInboxItem;
      order: { id: string; number: string };
    },
  };
}

export type WaSuggestLine = {
  productId: string;
  sku: string;
  name: string;
  matchedToken: string;
  score: number;
};

export async function fetchWaSuggestLines(
  id: string,
): Promise<
  | {
      ok: true;
      data: {
        messageId: string;
        bodyText: string | null;
        suggestedQty: number | null;
        items: WaSuggestLine[];
      };
    }
  | ApiFail
> {
  const res = await fetch(`/api/v1/sales/wa-inbox/${id}/suggest-lines`, {
    credentials: "include",
  });
  if (!res.ok) return parseFail(res);
  return {
    ok: true,
    data: (await res.json()) as {
      messageId: string;
      bodyText: string | null;
      suggestedQty: number | null;
      items: WaSuggestLine[];
    },
  };
}

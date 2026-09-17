/** Client helpers for in-app inbox (`/api/v1/notifications`) — D247. */

import type {
  NotificationItem,
  NotificationPriority,
  NotificationType,
} from "@/lib/notifications";

export type ApiNotification = {
  id: string;
  companyId: string;
  source: string;
  sourceRefId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

type ApiFail = { ok: false; status: number; message: string };

async function parseFail(res: Response): Promise<ApiFail> {
  try {
    const body = (await res.json()) as { message?: string };
    return {
      ok: false,
      status: res.status,
      message:
        typeof body.message === "string"
          ? body.message
          : res.statusText || "Erreur",
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      message: res.statusText || "Erreur",
    };
  }
}

function toItem(n: ApiNotification): NotificationItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt,
    read: n.read,
    priority: n.priority,
    href: n.href ?? undefined,
    source: n.source,
  };
}

export async function syncNotifications(): Promise<
  | { ok: true; data: { items: NotificationItem[]; unreadCount: number; upserted: number } }
  | ApiFail
> {
  try {
    const res = await fetch("/api/v1/notifications/sync", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    const body = (await res.json()) as {
      items: ApiNotification[];
      unreadCount: number;
      upserted: number;
    };
    return {
      ok: true,
      data: {
        items: body.items.map(toItem),
        unreadCount: body.unreadCount,
        upserted: body.upserted,
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function fetchNotifications(opts?: {
  unreadOnly?: boolean;
}): Promise<
  | { ok: true; data: { items: NotificationItem[]; unreadCount: number } }
  | ApiFail
> {
  try {
    const sp = new URLSearchParams();
    if (opts?.unreadOnly) sp.set("unread", "1");
    const qs = sp.toString();
    const res = await fetch(
      `/api/v1/notifications${qs ? `?${qs}` : ""}`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!res.ok) return parseFail(res);
    const body = (await res.json()) as {
      items: ApiNotification[];
      unreadCount: number;
    };
    return {
      ok: true,
      data: {
        items: body.items.map(toItem),
        unreadCount: body.unreadCount,
      },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function markNotificationRead(
  id: string,
): Promise<{ ok: true; data: NotificationItem } | ApiFail> {
  try {
    const res = await fetch(`/api/v1/notifications/${id}/read`, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return { ok: true, data: toItem((await res.json()) as ApiNotification) };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export async function markAllNotificationsRead(): Promise<
  { ok: true; data: { marked: number } } | ApiFail
> {
  try {
    const res = await fetch("/api/v1/notifications/read-all", {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return parseFail(res);
    return {
      ok: true,
      data: (await res.json()) as { marked: number },
    };
  } catch {
    return { ok: false, status: 0, message: "Réseau indisponible." };
  }
}

export type NotificationType =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "task"
  | "system";

export type NotificationPriority = "p0" | "p1" | "p2" | "p3";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  priority: NotificationPriority;
  href?: string;
  /** Métier source key (D247) — optional for legacy/mock. */
  source?: string;
};

/** Default SSE endpoint (Next route — not rewritten to Nest). */
export const NOTIFICATION_SSE_PATH = "/dev/notifications/stream";

/**
 * Resolve exact in-app source for a notification (shortcut target).
 * Prefer explicit `href`; else infer from type / title keywords.
 */
export function resolveNotificationHref(item: NotificationItem): string {
  if (item.href) return item.href;
  if (item.source === "CREDIT_BREACH") return "/finance";
  if (item.source === "PROMISE_OVERDUE") return "/finance/promises";
  if (item.source === "PORTAL_PAYMENT_DECL")
    return "/finance/payment-declarations";
  if (item.source === "DUNNING_READY") return "/finance";
  if (item.source === "TEJ_PENDING") return "/settings#expertise";
  if (item.source === "ATM_REVIEW") return "/automation";
  if (item.source === "RAS_PENDING") return "/settings#expertise";
  if (item.source === "WA_INBOX") return "/sales/wa-inbox";
  const hay = `${item.title} ${item.body}`.toLowerCase();
  if (/whatsapp|wa inbox|wamid/.test(hay)) return "/sales/wa-inbox";
  if (/lot|quarant|stock|invent|ccp|emmental|brie/.test(hay)) return "/inventory";
  if (/commande|order|so-|validation commande|sfax/.test(hay)) return "/sales";
  if (/facture|invoice|ar |paiement|finance|déclaration|promesse|relance/.test(hay))
    return "/finance";
  if (/livraison|shipment|bl-|réception|reception/.test(hay)) return "/delivery";
  if (/ras|tej|expertise|patch|spectre|heartbeat|thunder|job|registry|sse/.test(hay))
    return "/settings#expertise";
  if (item.type === "task") return "/finance";
  if (item.type === "warning" || item.type === "danger") return "/finance";
  if (item.type === "system") return "/settings";
  return "/";
}

export const SEED_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "n-seed-1",
    type: "warning",
    title: "Quarantaine lot LOT-2026-0042",
    body: "Brie 250 — échantillon CCP hors limite. Action requise.",
    createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    read: false,
    priority: "p0",
    href: "/inventory/lots",
  },
  {
    id: "n-seed-2",
    type: "task",
    title: "Validation commande SO-2026-0042",
    body: "Commande Sfax en attente de confirmation stock.",
    createdAt: new Date(Date.now() - 45 * 60_000).toISOString(),
    read: false,
    priority: "p1",
    href: "/sales",
  },
  {
    id: "n-seed-3",
    type: "info",
    title: "Registry modules synchronisé",
    body: "GET /api/v1/me/registry — 11 modules catalogue.",
    createdAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    read: true,
    priority: "p3",
    href: "/settings",
  },
  {
    id: "n-seed-4",
    type: "system",
    title: "PATCH MODE disponible",
    body: "Correctifs hot-path sans redémarrage complet.",
    createdAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),
    read: true,
    priority: "p2",
    href: "/settings",
  },
];

export function unreadCount(items: NotificationItem[]): number {
  return items.filter((n) => !n.read).length;
}

/** Client UX filter for « Alertes jobs » preference. */
export function isJobAlert(n: NotificationItem): boolean {
  const hay = `${n.title} ${n.body}`.toLowerCase();
  return /shed|thunder|job|file critical|p4|dlq|concurrenc|bullmq/.test(hay);
}

export function markRead(
  items: NotificationItem[],
  id: string,
): NotificationItem[] {
  return items.map((n) => (n.id === id ? { ...n, read: true } : n));
}

export function markAllRead(items: NotificationItem[]): NotificationItem[] {
  return items.map((n) => (n.read ? n : { ...n, read: true }));
}

export function upsertNotification(
  items: NotificationItem[],
  next: NotificationItem,
): NotificationItem[] {
  const idx = items.findIndex((n) => n.id === next.id);
  if (idx === -1) return [next, ...items];
  const copy = items.slice();
  copy[idx] = { ...copy[idx], ...next };
  return copy;
}

export function isP0(item: NotificationItem): boolean {
  return item.priority === "p0" || item.type === "danger";
}

const STREAM_TEMPLATES: Omit<NotificationItem, "id" | "createdAt" | "read">[] =
  [
    {
      type: "info",
      title: "Job Thunder terminé",
      body: "hello-job — statut succeeded.",
      priority: "p3",
      href: "/settings",
    },
    {
      type: "task",
      title: "Réception fournisseur",
      body: "BL-8821 — contrôler température chambre froide.",
      priority: "p1",
      href: "/delivery",
    },
    {
      type: "warning",
      title: "Stock bas — Emmental 1kg",
      body: "Seuil min atteint sur site Sfax.",
      priority: "p1",
      href: "/inventory",
    },
    {
      type: "system",
      title: "Heartbeat notifications",
      body: "Flux SSE actif.",
      priority: "p3",
      href: "/settings",
    },
  ];

export function nextStreamNotification(seq: number): NotificationItem {
  const t = STREAM_TEMPLATES[seq % STREAM_TEMPLATES.length]!;
  return {
    ...t,
    id: `n-live-${seq}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

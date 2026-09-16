"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isP0,
  resolveNotificationHref,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";
import {
  NOTIF_SOURCE_KEYS,
  NOTIF_SOURCE_META,
  isNotifSourceKey,
} from "@/lib/notification-prefs";
import { FeedGlyph, iconForNotificationType } from "@/components/shell/feed-icons";
import { NotifPrefsPanel } from "@/components/settings/notif-prefs-panel";
import { useLocaleStore } from "@/stores/locale-store";
import { usePrefsStore } from "@/stores/prefs-store";
import { ADrawer } from "./a-drawer";
import { AEmptyState } from "./a-empty-state";
import { AButton } from "./a-button";

export type AActivityCenterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Ids that just arrived — trigger enter animation. */
  freshIds?: Set<string>;
};

const typeLabelFr: Record<NotificationType, string> = {
  success: "Succès",
  info: "Info",
  warning: "Alerte",
  danger: "Critique",
  task: "Tâche",
  system: "Système",
};

const typeLabelIt: Record<NotificationType, string> = {
  success: "Successo",
  info: "Info",
  warning: "Avviso",
  danger: "Critico",
  task: "Task",
  system: "Sistema",
};

function formatWhen(iso: string, locale: "fr" | "it"): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return locale === "it" ? "adesso" : "à l’instant";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return locale === "it" ? `${m} min fa` : `il y a ${m} min`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return locale === "it" ? `${h} h fa` : `il y a ${h} h`;
  }
  return d.toLocaleString(locale === "it" ? "it-IT" : "fr-TN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Soft Glass notifications inbox (D247–D249).
 * Mute prefs · enter animation · AUTHORITY audio handled by host.
 */
export function AActivityCenter({
  open,
  onOpenChange,
  items,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
  refreshing,
  freshIds,
}: AActivityCenterProps) {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const it = locale === "it";
  const notifMuted = usePrefsStore((s) => s.notifMuted);
  const setNotifMuted = usePrefsStore((s) => s.setNotifMuted);
  const notifAnimEnabled = usePrefsStore((s) => s.notifAnimEnabled);
  const [filter, setFilter] = useState<"all" | "unread">("unread");
  const [source, setSource] = useState<string>("");
  const [prefsOpen, setPrefsOpen] = useState(false);

  const visible = useMemo(() => {
    let list = items.filter((n) => {
      if (!isNotifSourceKey(n.source)) return true;
      return !notifMuted[n.source];
    });
    if (filter === "unread") list = list.filter((n) => !n.read);
    if (source) list = list.filter((n) => n.source === source);
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items, filter, source, notifMuted]);

  const unread = items.filter((n) => {
    if (n.read) return false;
    if (isNotifSourceKey(n.source) && notifMuted[n.source]) return false;
    return true;
  }).length;

  const typeLabel = it ? typeLabelIt : typeLabelFr;

  return (
    <ADrawer
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setPrefsOpen(false);
      }}
      title={it ? "Centro notifiche" : "Centre de notifications"}
      description={
        prefsOpen
          ? it
            ? "Parametri postazione — mute, audio, animazioni"
            : "Paramètres poste — mute, audio, animations"
          : unread > 0
            ? it
              ? `${unread} non lett${unread > 1 ? "i" : "o"}`
              : `${unread} non lu${unread > 1 ? "s" : ""}`
            : it
              ? "Tutto aggiornato"
              : "Tout est à jour"
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              variant={prefsOpen ? "primary" : "ghost"}
              size="sm"
              onClick={() => setPrefsOpen((p) => !p)}
            >
              <Settings2 className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.5} />
              {it ? "Parametri" : "Paramètres"}
            </AButton>
            {!prefsOpen ? (
              <>
                <AButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={unread === 0}
                  onClick={onMarkAllRead}
                >
                  {it ? "Segna tutti letti" : "Tout marquer lu"}
                </AButton>
                {onRefresh ? (
                  <AButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={refreshing}
                    onClick={onRefresh}
                  >
                    {refreshing ? "Sync…" : it ? "Aggiorna" : "Actualiser"}
                  </AButton>
                ) : null}
              </>
            ) : null}
          </div>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {it ? "Chiudi" : "Fermer"}
          </AButton>
        </div>
      }
    >
      {prefsOpen ? (
        <div className="space-y-3">
          <NotifPrefsPanel compact />
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            <Link
              href="/settings#poste"
              className="text-a-accent hover:underline"
              onClick={() => onOpenChange(false)}
            >
              {it ? "Apri in Preferenze › Poste" : "Ouvrir dans Préférences › Poste"}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <div className="mb-2 flex gap-1 rounded-[var(--a-radius-md)] bg-a-surface-3 p-0.5">
            {(
              [
                ["unread", it ? "Non letti" : "Non lus"],
                ["all", it ? "Tutti" : "Tous"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "flex-1 rounded-[var(--a-radius-sm)] px-2 py-1.5 text-[length:var(--a-text-xs)] transition-colors",
                  filter === key
                    ? "bg-a-surface-2 text-a-fg"
                    : "text-a-fg-muted hover:text-a-fg",
                )}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mb-3 flex flex-wrap gap-1">
            <button
              type="button"
              className={cn(
                "rounded-[var(--a-radius-sm)] px-2 py-1 text-[length:var(--a-text-xs)] transition-colors",
                source === ""
                  ? "bg-a-accent-muted text-a-accent"
                  : "bg-a-surface-3 text-a-fg-muted hover:text-a-fg",
              )}
              onClick={() => setSource("")}
            >
              {it ? "Tutto" : "Tout"}
            </button>
            {NOTIF_SOURCE_KEYS.map((key) => {
              const meta = NOTIF_SOURCE_META[key];
              const muted = notifMuted[key];
              const active = source === key;
              const short =
                key === "PORTAL_PAYMENT_DECL"
                  ? it
                    ? "Portale"
                    : "Portail"
                  : key === "PROMISE_OVERDUE"
                    ? it
                      ? "Promesse"
                      : "Promesses"
                    : key === "DUNNING_READY"
                      ? it
                        ? "Solleciti"
                        : "Relances"
                      : key === "CREDIT_BREACH"
                        ? it
                          ? "Credito"
                          : "Crédit"
                        : key === "ATM_REVIEW"
                          ? "Auto"
                          : key === "WA_INBOX"
                            ? "WA"
                            : key === "RAS_PENDING"
                              ? "RAS"
                              : key === "PROD_NEED"
                                ? it
                                  ? "Prod"
                                  : "Prod"
                                : "TEJ";
              return (
                <button
                  key={key}
                  type="button"
                  title={
                    muted
                      ? `${it ? meta.it : meta.fr} · muted`
                      : it
                        ? meta.it
                        : meta.fr
                  }
                  className={cn(
                    "rounded-[var(--a-radius-sm)] px-2 py-1 text-[length:var(--a-text-xs)] transition-colors",
                    active
                      ? "bg-a-accent-muted text-a-accent"
                      : muted
                        ? "bg-a-surface-3 text-a-fg-subtle line-through opacity-60"
                        : "bg-a-surface-3 text-a-fg-muted hover:text-a-fg",
                  )}
                  onClick={() => setSource(active ? "" : key)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setNotifMuted(key, !muted);
                  }}
                >
                  {short}
                  {muted ? " · mute" : ""}
                </button>
              );
            })}
          </div>
          <p className="mb-2 text-[length:var(--a-text-xs)] text-a-fg-subtle">
            {it
              ? "Clic destro su un chip = mute / unmute."
              : "Clic droit sur un chip = mute / unmute."}
          </p>

          {visible.length === 0 ? (
            <AEmptyState
              title={
                filter === "unread"
                  ? it
                    ? "Niente di nuovo"
                    : "Rien de nouveau"
                  : it
                    ? "Nessuna notifica"
                    : "Aucune notification"
              }
              description={
                it
                  ? "Controlla i mute in Parametri, poi Aggiorna."
                  : "Vérifiez les mute dans Paramètres, puis Actualiser."
              }
            />
          ) : (
            <ul className="a-scroll-momentum a-notif-list">
              {visible.map((item, idx) => {
                const fresh = freshIds?.has(item.id) ?? false;
                const critical = isP0(item);
                const animClass =
                  notifAnimEnabled && fresh
                    ? critical
                      ? "a-notif-enter-p0"
                      : "a-notif-enter"
                    : notifAnimEnabled
                      ? "a-notif-enter"
                      : "";
                return (
                  <li
                    key={item.id}
                    className={cn("a-notif-snap", animClass)}
                    style={{ ["--a-notif-i" as string]: idx }}
                  >
                    <NotificationRow
                      item={item}
                      typeLabel={typeLabel}
                      when={formatWhen(item.createdAt, it ? "it" : "fr")}
                      markLabel={it ? "Letto" : "Lu"}
                      onActivate={() => {
                        onMarkRead(item.id);
                        onOpenChange(false);
                        router.push(resolveNotificationHref(item));
                      }}
                      onMarkRead={() => onMarkRead(item.id)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </ADrawer>
  );
}

function NotificationRow({
  item,
  typeLabel,
  when,
  markLabel,
  onActivate,
  onMarkRead,
}: {
  item: NotificationItem;
  typeLabel: Record<NotificationType, string>;
  when: string;
  markLabel: string;
  onActivate: () => void;
  onMarkRead: () => void;
}) {
  const critical = isP0(item);
  const feed = iconForNotificationType(item.type);
  return (
    <article
      className={cn(
        "a-underlay rounded-[var(--a-radius-md)] px-3 py-2.5",
        item.read ? "opacity-70" : "",
        critical && !item.read && "bg-a-danger-soft",
      )}
    >
      <div className="flex items-start gap-2.5">
        <FeedGlyph def={feed} size={15} />
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={onActivate}
          >
            <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-wider text-a-fg-subtle">
              {typeLabel[item.type]}
              {item.source ? ` · ${item.source}` : ""}
              {critical ? " · P0" : ""}
            </p>
            <p
              className={cn(
                "mt-0.5 text-[length:var(--a-text-sm)]",
                item.read ? "text-a-fg-muted" : "font-medium text-a-fg",
              )}
            >
              {item.title}
            </p>
            <p className="mt-0.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
              {item.body}
            </p>
            <p className="mt-1 a-mono text-[length:var(--a-text-xs)] text-a-fg-subtle">
              {when}
            </p>
          </button>
          {!item.read ? (
            <button
              type="button"
              className="shrink-0 text-[length:var(--a-text-xs)] text-a-accent hover:underline"
              onClick={onMarkRead}
            >
              {markLabel}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

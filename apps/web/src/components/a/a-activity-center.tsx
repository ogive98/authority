"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isP0,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";
import { ADrawer } from "./a-drawer";
import { AEmptyState } from "./a-empty-state";
import { AButton } from "./a-button";

export type AActivityCenterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NotificationItem[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
};

const typeLabel: Record<NotificationType, string> = {
  success: "Succès",
  info: "Info",
  warning: "Alerte",
  danger: "Critique",
  task: "Tâche",
  system: "Système",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "à l’instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)} h`;
  return d.toLocaleString("fr-TN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Activity / notifications inbox. P0 stays in centre (no toast).
 */
export function AActivityCenter({
  open,
  onOpenChange,
  items,
  onMarkRead,
  onMarkAllRead,
}: AActivityCenterProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const visible = useMemo(() => {
    const list = filter === "unread" ? items.filter((n) => !n.read) : items;
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items, filter]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <ADrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Centre d’activité"
      description={
        unread > 0
          ? `${unread} non lu${unread > 1 ? "s" : ""}`
          : "Tout est à jour"
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <AButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={unread === 0}
            onClick={onMarkAllRead}
          >
            Tout marquer lu
          </AButton>
          <AButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </AButton>
        </div>
      }
    >
      <div className="mb-3 flex gap-1 rounded-[var(--a-radius-md)] border border-a-border-subtle bg-a-surface-3 p-0.5">
        {(
          [
            ["unread", "Non lus"],
            ["all", "Tous"],
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

      {visible.length === 0 ? (
        <AEmptyState
          title={filter === "unread" ? "Rien de nouveau" : "Aucune notification"}
          description={
            filter === "unread"
              ? "Les alertes non lues apparaîtront ici."
              : "Le flux SSE alimentera ce centre."
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <NotificationRow
                item={item}
                onActivate={() => {
                  onMarkRead(item.id);
                  if (item.href) {
                    onOpenChange(false);
                    router.push(item.href);
                  }
                }}
                onMarkRead={() => onMarkRead(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </ADrawer>
  );
}

function NotificationRow({
  item,
  onActivate,
  onMarkRead,
}: {
  item: NotificationItem;
  onActivate: () => void;
  onMarkRead: () => void;
}) {
  const critical = isP0(item);
  return (
    <article
      className={cn(
        "rounded-[var(--a-radius-md)] border px-3 py-2.5",
        item.read
          ? "border-a-border-subtle bg-a-surface-1/40"
          : "border-a-border-subtle bg-a-surface-3",
        critical && !item.read && "border-a-danger/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onActivate}
        >
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-wider text-a-fg-subtle">
            {typeLabel[item.type]}
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
            {formatWhen(item.createdAt)}
          </p>
        </button>
        {!item.read ? (
          <button
            type="button"
            className="shrink-0 text-[length:var(--a-text-xs)] text-a-accent hover:underline"
            onClick={onMarkRead}
          >
            Lu
          </button>
        ) : null}
      </div>
    </article>
  );
}

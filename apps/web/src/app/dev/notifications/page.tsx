"use client";

import Link from "next/link";
import {
  AActivityCenter,
  AButton,
  AOfflineBanner,
} from "@/components/a";
import { ThemeToggle } from "@/components/shell";
import { useNotificationSse } from "@/hooks/use-notification-sse";
import { unreadCount } from "@/lib/notifications";
import { useNotificationsStore } from "@/stores/notifications-store";

export default function DevNotificationsPage() {
  useNotificationSse();

  const items = useNotificationsStore((s) => s.items);
  const sseStatus = useNotificationsStore((s) => s.sseStatus);
  const inboxOpen = useNotificationsStore((s) => s.inboxOpen);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const markItemRead = useNotificationsStore((s) => s.markItemRead);
  const markAllItemsRead = useNotificationsStore((s) => s.markAllItemsRead);
  const pauseSse = useNotificationsStore((s) => s.pauseSse);
  const resumeSse = useNotificationsStore((s) => s.resumeSse);
  const unread = unreadCount(items);

  return (
    <div className="min-h-screen bg-a-surface-1 text-a-fg">
      <AActivityCenter
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        items={items}
        onMarkRead={markItemRead}
        onMarkAllRead={markAllItemsRead}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-a-border-subtle px-[var(--a-space-6)] py-[var(--a-space-4)]">
        <div>
          <p className="a-mono text-[length:var(--a-text-xs)] uppercase tracking-widest text-a-fg-subtle">
            UI-09 · Notifications
          </p>
          <h1 className="mt-1 text-[length:var(--a-text-xl)] font-semibold">
            Centre d’activité + SSE
          </h1>
          <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
            Gate : couper le flux → bannière « Flux temps réel coupé »
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ThemeToggle />
          <AButton type="button" size="sm" onClick={() => setInboxOpen(true)}>
            Ouvrir inbox ({unread})
          </AButton>
          <Link
            href="/"
            className="text-[length:var(--a-text-sm)] text-a-fg-muted hover:text-a-accent"
          >
            Shell
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-[var(--a-space-6)] px-[var(--a-space-6)] py-[var(--a-space-7)]">
        <section className="a-card space-y-3 p-4">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            État SSE
          </h2>
          <p className="a-mono text-[length:var(--a-text-sm)]">
            status ={" "}
            <span className="text-a-accent">{sseStatus}</span>
          </p>
          <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
            Source mock :{" "}
            <span className="a-mono">/dev/notifications/stream</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <AButton
              type="button"
              variant="danger"
              size="sm"
              disabled={sseStatus === "disconnected"}
              onClick={() => pauseSse()}
            >
              Couper le flux
            </AButton>
            <AButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={sseStatus === "connected" || sseStatus === "connecting"}
              onClick={() => resumeSse()}
            >
              Reconnecter
            </AButton>
          </div>
        </section>

        {sseStatus === "disconnected" ? (
          <section className="space-y-2">
            <h2 className="text-[length:var(--a-text-lg)] font-medium">
              Bannière (gate)
            </h2>
            <AOfflineBanner sseLost />
          </section>
        ) : null}

        <section className="a-card space-y-2 p-4">
          <h2 className="text-[length:var(--a-text-lg)] font-medium">
            Inbox seed
          </h2>
          <ul className="space-y-2 text-[length:var(--a-text-sm)]">
            {items.slice(0, 6).map((n) => (
              <li key={n.id} className="flex justify-between gap-2">
                <span className={n.read ? "text-a-fg-muted" : "text-a-fg"}>
                  [{n.type}] {n.title}
                </span>
                <span className="a-mono shrink-0 text-a-fg-subtle">
                  {n.read ? "lu" : "non lu"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            P0 (quarantaine) reste dans le centre — pas de toast.
          </p>
        </section>
      </main>
    </div>
  );
}

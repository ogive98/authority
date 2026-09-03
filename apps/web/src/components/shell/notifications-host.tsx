"use client";

import { AActivityCenter, AOfflineBanner } from "@/components/a";
import { useNotificationSse } from "@/hooks/use-notification-sse";
import { useNotificationsStore } from "@/stores/notifications-store";

/** Shell host: SSE subscription, disconnect banner, activity drawer. */
export function NotificationsHost() {
  useNotificationSse();

  const items = useNotificationsStore((s) => s.items);
  const sseStatus = useNotificationsStore((s) => s.sseStatus);
  const inboxOpen = useNotificationsStore((s) => s.inboxOpen);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const markItemRead = useNotificationsStore((s) => s.markItemRead);
  const markAllItemsRead = useNotificationsStore((s) => s.markAllItemsRead);

  const sseLost = sseStatus === "disconnected";

  return (
    <>
      {sseLost ? (
        <div className="fixed top-12 inset-x-0 z-[var(--a-z-toast)] px-3 pt-2 md:px-4">
          <AOfflineBanner sseLost className="mx-auto max-w-3xl" />
        </div>
      ) : null}
      <AActivityCenter
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        items={items}
        onMarkRead={markItemRead}
        onMarkAllRead={markAllItemsRead}
      />
    </>
  );
}

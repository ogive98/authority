"use client";

import { useMemo } from "react";
import { AActivityCenter, AOfflineBanner } from "@/components/a";
import { useNotificationSse } from "@/hooks/use-notification-sse";
import { isJobAlert } from "@/lib/notifications";
import { useNotificationsStore } from "@/stores/notifications-store";
import { usePrefsStore } from "@/stores/prefs-store";

/** Shell host: SSE subscription, disconnect banner, activity drawer. */
export function NotificationsHost() {
  useNotificationSse();

  const items = useNotificationsStore((s) => s.items);
  const sseStatus = useNotificationsStore((s) => s.sseStatus);
  const inboxOpen = useNotificationsStore((s) => s.inboxOpen);
  const setInboxOpen = useNotificationsStore((s) => s.setInboxOpen);
  const markItemRead = useNotificationsStore((s) => s.markItemRead);
  const markAllItemsRead = useNotificationsStore((s) => s.markAllItemsRead);
  const showSseBanner = usePrefsStore((s) => s.showSseBanner);
  const jobAlerts = usePrefsStore((s) => s.jobAlerts);

  const visibleItems = useMemo(
    () => (jobAlerts ? items : items.filter((n) => !isJobAlert(n))),
    [items, jobAlerts],
  );

  const sseLost = showSseBanner && sseStatus === "disconnected";

  return (
    <>
      {sseLost ? (
        <div className="pointer-events-none fixed top-12 inset-x-0 z-[var(--a-z-toast)] flex justify-center px-3 pt-2 md:px-4">
          <div className="pointer-events-auto w-fit max-w-3xl">
            <AOfflineBanner sseLost />
          </div>
        </div>
      ) : null}
      <AActivityCenter
        open={inboxOpen}
        onOpenChange={setInboxOpen}
        items={visibleItems}
        onMarkRead={markItemRead}
        onMarkAllRead={markAllItemsRead}
      />
    </>
  );
}

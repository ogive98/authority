"use client";

import { useEffect } from "react";
import {
  NOTIFICATION_SSE_PATH,
  type NotificationItem,
} from "@/lib/notifications";
import { useNotificationsStore } from "@/stores/notifications-store";

type StreamMessage =
  | { kind: "snapshot"; items: NotificationItem[] }
  | { kind: "notification"; item: NotificationItem };

export type UseNotificationSseOptions = {
  /** Override stream URL (default mock gate path). */
  url?: string;
  enabled?: boolean;
};

const RECONNECT_MS = 4000;

/**
 * Subscribes to notification SSE. On error: mark disconnected and retry.
 */
export function useNotificationSse(options: UseNotificationSseOptions = {}) {
  const url = options.url ?? NOTIFICATION_SSE_PATH;
  const enabled = options.enabled ?? true;
  const ssePaused = useNotificationsStore((s) => s.ssePaused);
  const sseGeneration = useNotificationsStore((s) => s.sseGeneration);
  const setSseStatus = useNotificationsStore((s) => s.setSseStatus);
  const applySnapshot = useNotificationsStore((s) => s.applySnapshot);
  const pushItem = useNotificationsStore((s) => s.pushItem);

  useEffect(() => {
    if (!enabled || ssePaused) {
      setSseStatus("disconnected");
      return;
    }

    let es: EventSource | null = null;
    let intentionalClose = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (intentionalClose) return;
      setSseStatus("connecting");
      es = new EventSource(url);

      es.onopen = () => {
        setSseStatus("connected");
      };

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as StreamMessage;
          if (data.kind === "snapshot" && Array.isArray(data.items)) {
            applySnapshot(data.items);
          } else if (data.kind === "notification" && data.item) {
            pushItem(data.item);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onerror = () => {
        if (intentionalClose) return;
        setSseStatus("disconnected");
        es?.close();
        es = null;
        retryTimer = setTimeout(connect, RECONNECT_MS);
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, [
    url,
    enabled,
    ssePaused,
    sseGeneration,
    setSseStatus,
    applySnapshot,
    pushItem,
  ]);
}

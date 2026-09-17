"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { monitorPollMs } from "@/lib/dev-light";
import type { ThunderMonitorSnapshot } from "@/lib/thunder/monitor-types";

export type MonitorSnapshot = ThunderMonitorSnapshot;

export const MONITOR_SNAPSHOT_QUERY_KEY = ["thunder-monitor"] as const;
export const MONITOR_SSE_PATH = "/api/v1/thunder/monitor/stream";

export async function fetchMonitorSnapshot(): Promise<ThunderMonitorSnapshot> {
  const res = await fetch("/api/v1/thunder/monitor/snapshot", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`monitor ${res.status}`);
  }
  return res.json() as Promise<ThunderMonitorSnapshot>;
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    function sync() {
      setVisible(document.visibilityState === "visible");
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/**
 * Thunder monitor — poll + SSE (reuse API `/thunder/monitor/stream`).
 * SSE updates React Query cache; poll is fallback / light-mode cadence.
 */
export function useMonitorSnapshot(opts?: { sse?: boolean }) {
  const visible = useDocumentVisible();
  const queryClient = useQueryClient();
  const sseWanted = opts?.sse !== false;
  const [sseLive, setSseLive] = useState(false);

  useEffect(() => {
    if (!sseWanted || !visible) {
      setSseLive(false);
      return;
    }

    let es: EventSource | null = null;
    let intentionalClose = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (intentionalClose) return;
      es = new EventSource(MONITOR_SSE_PATH, { withCredentials: true });

      es.onopen = () => setSseLive(true);

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as unknown;
          const data =
            parsed &&
            typeof parsed === "object" &&
            "schemaVersion" in parsed &&
            (parsed as ThunderMonitorSnapshot).schemaVersion === 1
              ? (parsed as ThunderMonitorSnapshot)
              : parsed &&
                  typeof parsed === "object" &&
                  "data" in parsed &&
                  typeof (parsed as { data: unknown }).data === "object"
                ? ((parsed as { data: ThunderMonitorSnapshot }).data)
                : null;
          if (data?.schemaVersion === 1) {
            queryClient.setQueryData(MONITOR_SNAPSHOT_QUERY_KEY, data);
          }
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onerror = () => {
        setSseLive(false);
        es?.close();
        es = null;
        if (!intentionalClose) {
          retryTimer = setTimeout(connect, 4000);
        }
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setSseLive(false);
    };
  }, [sseWanted, visible, queryClient]);

  return useQuery({
    queryKey: MONITOR_SNAPSHOT_QUERY_KEY,
    queryFn: fetchMonitorSnapshot,
    // When SSE is live, poll sparsely as safety net; otherwise normal cadence.
    refetchInterval: visible
      ? sseLive
        ? Math.max(monitorPollMs() * 4, 30_000)
        : monitorPollMs()
      : false,
    refetchIntervalInBackground: false,
    retry: false,
  });
}

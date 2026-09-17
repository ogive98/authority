"use client";

import { useQuery } from "@tanstack/react-query";
import { monitorPollMs } from "@/lib/dev-light";
import type { ThunderMonitorSnapshot } from "@/lib/thunder/monitor-types";

export type MonitorSnapshot = ThunderMonitorSnapshot;

export const MONITOR_SNAPSHOT_QUERY_KEY = ["thunder-monitor"] as const;

const FETCH_TIMEOUT_MS = 5_000;

export async function fetchMonitorSnapshot(
  signal?: AbortSignal,
): Promise<ThunderMonitorSnapshot> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/v1/thunder/monitor/snapshot", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`monitor ${res.status}`);
    return (await res.json()) as ThunderMonitorSnapshot;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Shell gauges / home — poll only, no SSE, slow cadence.
 * Command Center uses `useThunderCcSnapshot` (isolated).
 */
export function useMonitorSnapshot(_opts?: { sse?: boolean }) {
  return useQuery({
    queryKey: MONITOR_SNAPSHOT_QUERY_KEY,
    queryFn: ({ signal }) => fetchMonitorSnapshot(signal),
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.hidden) return false;
      const ms = monitorPollMs();
      return ms === false ? false : Math.max(ms, 30_000);
    },
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 15_000,
  });
}

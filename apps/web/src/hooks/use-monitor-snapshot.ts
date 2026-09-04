"use client";

import { useQuery } from "@tanstack/react-query";

/** Client shape of GET /api/v1/thunder/monitor/snapshot (schemaVersion 1). */

export type MonitorSnapshot = {
  cpu: { usageRatio: number | null; cores: number };
  ram: { usageRatio: number };
  jobs: {
    pending: number;
    running: number;
    dlq: number;
    failed: number;
  };
  workers: {
    enabled: boolean;
    queues: Array<{ family: string; concurrency: number }>;
  };
  pressure: { shedP4: boolean; reason?: string };
  redis: { ok: boolean };
  db: { ok: boolean };
  systemMode: string;
};

export async function fetchMonitorSnapshot(): Promise<MonitorSnapshot> {
  const res = await fetch("/api/v1/thunder/monitor/snapshot", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`monitor ${res.status}`);
  }
  return res.json() as Promise<MonitorSnapshot>;
}

export function useMonitorSnapshot() {
  return useQuery({
    queryKey: ["thunder-monitor"],
    queryFn: fetchMonitorSnapshot,
    refetchInterval: 5_000,
    retry: false,
  });
}

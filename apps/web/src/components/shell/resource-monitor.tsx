"use client";

import { useThunderMonitor } from "@/hooks/use-thunder-cc-snapshot";

/** Footer resource strip — shared Thunder poll (no SSE). */
export function ResourceMonitor() {
  const q = useThunderMonitor({ live: true, intervalMs: 30_000 });
  const s = q.data;
  const metrics = [
    {
      key: "CPU",
      value:
        s?.cpu.usageRatio == null
          ? "—"
          : `${Math.round(s.cpu.usageRatio * 100)}%`,
    },
    {
      key: "RAM",
      value: s ? `${Math.round(s.ram.usageRatio * 100)}%` : "—",
    },
    {
      key: "Jobs",
      value: s ? `${s.jobs.running}/${s.jobs.pending}` : "—",
    },
    { key: "DB", value: s ? (s.db.ok ? "ok" : "down") : "—" },
    { key: "Redis", value: s ? (s.redis.ok ? "ok" : "down") : "—" },
  ] as const;

  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-3 overflow-x-auto border-t border-[color:var(--a-border-subtle)] bg-a-surface-2 px-3"
      aria-label="Ressources système"
    >
      {metrics.map((m) => (
        <span
          key={m.key}
          className="a-mono a-tabular shrink-0 text-[length:var(--a-text-xs)] text-a-fg-subtle"
        >
          {m.key} {m.value}
        </span>
      ))}
    </footer>
  );
}

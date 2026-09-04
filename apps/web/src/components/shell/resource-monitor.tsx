"use client";

import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";

export function ResourceMonitor() {
  const q = useMonitorSnapshot();
  const cpu =
    q.data?.cpu.usageRatio == null
      ? "—"
      : `${Math.round(q.data.cpu.usageRatio * 100)}%`;
  const ram = q.data
    ? `${Math.round(q.data.ram.usageRatio * 100)}%`
    : "—";
  const shed = q.data?.pressure.shedP4 ? "P4 shed" : "ok";
  const jobs = q.data
    ? `${q.data.jobs.running}/${q.data.jobs.pending}`
    : "—";

  const metrics = [
    { key: "CPU", value: cpu },
    { key: "RAM", value: ram },
    { key: "Shed", value: shed },
    { key: "Jobs", value: jobs },
    { key: "DB", value: q.data?.db.ok ? "ok" : q.isError ? "n/a" : "…" },
    { key: "Redis", value: q.data?.redis.ok ? "ok" : q.isError ? "n/a" : "…" },
  ] as const;

  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-3 overflow-x-auto border-t border-a-border-subtle bg-a-surface-2 px-3"
      aria-label="Resource monitor"
    >
      <span className="a-mono shrink-0 text-[length:var(--a-text-xs)] text-a-fg-subtle">
        monitor
      </span>
      {metrics.map((m) => (
        <span
          key={m.key}
          className="a-mono shrink-0 text-[length:var(--a-text-xs)] text-a-fg-muted"
        >
          <span className="text-a-fg-subtle">{m.key}</span> {m.value}
        </span>
      ))}
    </footer>
  );
}

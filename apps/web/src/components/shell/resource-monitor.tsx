"use client";

/** Compact ResourceMonitor — mock data until THU-07 wiring. */
const METRICS = [
  { key: "CPU", value: "12 %" },
  { key: "RAM", value: "41 %" },
  { key: "Workers", value: "4" },
  { key: "Queues", value: "6" },
  { key: "Jobs", value: "0" },
  { key: "DB", value: "ok" },
  { key: "Redis", value: "ok" },
  { key: "Lat", value: "18 ms" },
] as const;

export function ResourceMonitor() {
  return (
    <footer
      className="flex h-8 shrink-0 items-center gap-3 overflow-x-auto border-t border-a-border-subtle bg-a-surface-2 px-3"
      aria-label="Resource monitor"
    >
      <span className="a-mono shrink-0 text-[length:var(--a-text-xs)] text-a-fg-subtle">
        monitor
      </span>
      {METRICS.map((m) => (
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

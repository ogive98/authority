"use client";

import { ASkeleton } from "@/components/a/a-skeleton";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";

export function MonitorWidgetBody() {
  const q = useMonitorSnapshot();
  if (q.isPending) return <ASkeleton lines={4} />;
  if (q.isError || !q.data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Snapshot indisponible (session / permission). File critical reste
        isolée côté API.
      </p>
    );
  }
  const s = q.data;
  const cpu =
    s.cpu.usageRatio == null
      ? "n/a"
      : `${Math.round(s.cpu.usageRatio * 100)} %`;
  const ram = `${Math.round(s.ram.usageRatio * 100)} %`;
  return (
    <dl className="grid grid-cols-2 gap-2 text-[length:var(--a-text-sm)]">
      <div>
        <dt className="text-a-fg-subtle">CPU</dt>
        <dd className="a-mono">{cpu}</dd>
      </div>
      <div>
        <dt className="text-a-fg-subtle">RAM</dt>
        <dd className="a-mono">{ram}</dd>
      </div>
      <div>
        <dt className="text-a-fg-subtle">Shed P4</dt>
        <dd className="a-mono">
          {s.pressure.shedP4 ? s.pressure.reason ?? "on" : "off"}
        </dd>
      </div>
      <div>
        <dt className="text-a-fg-subtle">Jobs</dt>
        <dd className="a-mono">
          {s.jobs.running} run / {s.jobs.pending} wait
        </dd>
      </div>
      <div>
        <dt className="text-a-fg-subtle">PG / Redis</dt>
        <dd>
          {s.db.ok ? "ok" : "down"} / {s.redis.ok ? "ok" : "down"}
        </dd>
      </div>
      <div>
        <dt className="text-a-fg-subtle">Mode</dt>
        <dd className="a-mono">{s.systemMode}</dd>
      </div>
    </dl>
  );
}

export function ModulesWidgetBody() {
  const { data, isPending } = useMeRegistry();
  if (isPending) return <ASkeleton lines={3} />;
  const modules = data.modules;
  if (modules.length === 0) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Aucun module ENABLED.
      </p>
    );
  }
  return (
    <ul className="space-y-1 text-[length:var(--a-text-sm)]">
      {modules.map((m) => (
        <li key={m.key} className="flex justify-between gap-2">
          <span>{m.name}</span>
          <span className="a-mono text-a-fg-subtle">{m.key}</span>
        </li>
      ))}
    </ul>
  );
}

export function JobsWidgetBody() {
  const q = useMonitorSnapshot();
  if (q.isPending) return <ASkeleton lines={3} />;
  if (q.isError || !q.data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Files Thunder non lisibles depuis cette session.
      </p>
    );
  }
  const lanes = q.data.workers.queues;
  return (
    <ul className="space-y-1 text-[length:var(--a-text-sm)]">
      {lanes.map((lane) => (
        <li key={lane.family} className="flex justify-between gap-2 a-mono">
          <span>{lane.family}</span>
          <span className="text-a-fg-muted">
            conc={lane.concurrency}
            {lane.concurrency === 0 ? " · paused" : ""}
          </span>
        </li>
      ))}
      <li className="flex justify-between gap-2 pt-1 text-a-fg-subtle">
        <span>DLQ</span>
        <span>{q.data.jobs.dlq}</span>
      </li>
    </ul>
  );
}

export function AuditWidgetBody() {
  return (
    <ul className="space-y-2 text-[length:var(--a-text-sm)] text-a-fg-muted">
      <li>Registry sync — GET /me/registry</li>
      <li>SSE notifications — flux mock UI-09</li>
      <li>Thunder snapshot — schemaVersion 1</li>
    </ul>
  );
}

export function BoomWidgetBody(): never {
  throw new Error("UI-10 gate: widget isolation");
}

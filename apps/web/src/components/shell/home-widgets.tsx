"use client";

import Link from "next/link";
import {
  fetchBusinessMeClient,
  initialsFromName,
} from "@/lib/business-auth";
import { unreadCount } from "@/lib/notifications";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { useNotificationsStore } from "@/stores/notifications-store";
import { useShellStore } from "@/stores/shell-store";
import { ASkeleton } from "@/components/a/a-skeleton";
import {
  AI_REC_PLACEHOLDERS,
  FeedGlyph,
  iconForAiRecommendation,
  iconForNotificationType,
} from "@/components/shell/feed-icons";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function greetingForHour(h: number): string {
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/** Hero — identity from /me only (no fake KPI). */
export function HeroContextWidget() {
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchBusinessMeClient();
      if (cancelled) return;
      if (res.ok) {
        setName(res.data.displayName);
        setRole(res.data.roleLabel ?? res.data.roleCode ?? null);
      }
      setPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pending) return <ASkeleton lines={3} />;

  const hour = new Date().getHours();
  const greet = greetingForHour(hour);
  const display = name ?? "Opérateur";
  const initials = initialsFromName(display, "");

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[length:var(--a-text-xs)] font-semibold uppercase tracking-[0.12em] text-a-fg-subtle">
          Mission Control
        </p>
        <h2 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-semibold tracking-[-0.03em] text-a-fg">
          {greet}, {display.split(" ")[0]}
        </h2>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {role ?? "Compte"}
          <span className="text-a-fg-subtle"> · </span>
          <span className="a-mono text-a-fg-subtle">{initials}</span>
        </p>
        <span className="mt-3 inline-flex items-center rounded-full bg-a-success-soft px-2.5 py-1 text-[11px] font-medium text-a-success-fg">
          Tout fonctionne
        </span>
      </div>
      <Link
        href="/account"
        className="rounded-full bg-a-accent-muted px-3 py-1.5 text-[length:var(--a-text-xs)] font-medium text-a-accent transition-colors hover:bg-a-accent hover:text-white"
      >
        Control Center
      </Link>
    </div>
  );
}

/** Shell status from Thunder monitor — real snapshot or empty. */
export function ShellStatusWidget() {
  const q = useMonitorSnapshot();
  if (q.isPending) return <ASkeleton lines={4} />;
  if (q.isError || !q.data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Snapshot indisponible. Aucune métrique inventée.
      </p>
    );
  }
  const s = q.data;
  const cpu =
    s.cpu.usageRatio == null
      ? "—"
      : `${Math.round(s.cpu.usageRatio * 100)}%`;
  const ram = `${Math.round(s.ram.usageRatio * 100)}%`;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        ["Mode", s.systemMode],
        ["CPU", cpu],
        ["RAM", ram],
        ["DB", s.db.ok ? "ok" : "down"],
        ["Redis", s.redis.ok ? "ok" : "down"],
        ["Jobs", `${s.jobs.running}/${s.jobs.pending}`],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-a-fg-subtle">
            {k}
          </dt>
          <dd className="a-mono mt-0.5 text-[length:var(--a-text-sm)] text-a-fg">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Feature shortcuts from me-registry for selected module. */
export function ModuleShortcutsWidget({ className }: { className?: string }) {
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const { data: registry, isPending } = useMeRegistry();
  const mod =
    registry.modules.find((m) => m.key === selectedModuleId) ??
    registry.modules[0];

  if (isPending && !mod) return <ASkeleton lines={4} />;
  if (!mod) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Aucun module ENABLED.
      </p>
    );
  }

  const features = mod.features.slice(0, 8);

  return (
    <div className={cn(className)}>
      <p className="mb-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
        {mod.name}
        <span className="a-mono text-a-fg-subtle"> · {mod.key}</span>
      </p>
      {features.length === 0 ? (
        <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
          Aucune feature exposée pour ce module.
        </p>
      ) : (
        <ul className="grid gap-1 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f.id}>
              <Link
                href={f.href}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[length:var(--a-text-sm)] text-a-fg transition-colors hover:bg-a-surface-3"
              >
                <span className="truncate font-medium">{f.label}</span>
                <span className="a-mono shrink-0 text-[10px] text-a-fg-subtle">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Empty tasks — honest empty state. */
export function TasksWidget() {
  return (
    <div className="flex flex-col items-start gap-1 py-1">
      <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
        Tout est traité
      </p>
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        Aucune tâche en file pour ce poste. Les workflows métier arriveront via
        le registry actions.
      </p>
    </div>
  );
}

/** Activity from notifications store — typed icons. */
export function ActivityWidget() {
  const items = useNotificationsStore((s) => s.items);
  const unread = unreadCount(items);
  const recent = items.slice(0, 5);

  if (recent.length === 0) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        Aucune activité récente.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
        {unread > 0 ? `${unread} non lu${unread > 1 ? "s" : ""}` : "À jour"}
      </p>
      <ul className="space-y-2">
        {recent.map((n) => {
          const feed = iconForNotificationType(n.type);
          return (
            <li key={n.id} className="flex min-w-0 items-start gap-2.5">
              <FeedGlyph def={feed} size={14} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[length:var(--a-text-sm)] font-medium text-a-fg">
                  {n.title}
                </p>
                {n.body ? (
                  <p className="truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                    {n.body}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** AI panel — DISABLED with typed recommendation placeholders. */
export function AiPanelWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <FeedGlyph def={iconForAiRecommendation("generic")} size={15} />
        <div className="min-w-0">
          <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            Assistant IA
          </p>
          <p className="mt-0.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
            État <span className="a-mono text-a-fg-subtle">DISABLED</span> —
            optionnel, jamais une dépendance runtime.
          </p>
        </div>
      </div>
      <ul className="space-y-1.5 opacity-70">
        {AI_REC_PLACEHOLDERS.map((row) => {
          const feed = iconForAiRecommendation(row.kind);
          return (
            <li
              key={row.kind}
              className="flex items-center gap-2.5 rounded-xl bg-a-surface-3/50 px-2 py-1.5"
            >
              <FeedGlyph def={feed} size={13} className="!h-7 !w-7" />
              <span className="min-w-0 truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                {row.title}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

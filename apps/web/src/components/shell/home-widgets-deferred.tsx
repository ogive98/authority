"use client";

/**
 * Below-the-fold Mission Control widgets (D296).
 * Loaded via next/dynamic from Mission Control — separate chunk from hero/KPI.
 */
import Link from "next/link";
import { resolveNotificationHref, unreadCount } from "@/lib/notifications";
import { isNotifSourceKey } from "@/lib/notification-prefs";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { useNotificationsStore } from "@/stores/notifications-store";
import { usePrefsStore } from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";
import { ASkeleton } from "@/components/a/a-skeleton";
import {
  personalityForFeature,
  resolveFeatureIcon,
} from "./icon-personality";
import {
  AI_REC_PLACEHOLDERS,
  FeedGlyph,
  iconForAiRecommendation,
  iconForNotificationType,
} from "@/components/shell/feed-icons";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useShellT } from "@/stores/locale-store";
import { fetchBankTreasury, type BankTreasury } from "@/lib/finance";
import { fetchBackupDashboard } from "@/lib/backup-api";

export function ShellStatusWidget() {
  const { t } = useShellT();
  const q = useMonitorSnapshot();
  if (q.isPending && !q.data) return <ASkeleton lines={4} />;
  if (!q.data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {t("snapshotNone")}
      </p>
    );
  }
  const s = q.data;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[
        ["Mode", s.systemMode],
        ["DB", s.db.ok ? "ok" : "down"],
        ["Redis", s.redis.ok ? "ok" : "down"],
        ["Jobs", `${s.jobs.running}/${s.jobs.pending}`],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {k}
          </dt>
          <dd className="a-mono a-tabular mt-0.5 text-[length:var(--a-text-sm)] text-a-fg">
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
                className="group flex items-center gap-2.5 rounded-[var(--a-radius-md)] px-2 py-2 text-[length:var(--a-text-sm)] text-a-fg transition-colors hover:bg-a-surface-3"
              >
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--a-radius-sm)] bg-a-accent-muted text-a-accent"
                  aria-hidden
                >
                  {(() => {
                    const Icon = resolveFeatureIcon(f.id, f.label);
                    const tone = personalityForFeature(f.id, f.label)
                      .colorClass;
                    return (
                      <Icon
                        className={cn("h-4 w-4", tone)}
                        strokeWidth={1.75}
                      />
                    );
                  })()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {f.label}
                </span>
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
  const { t } = useShellT();
  return (
    <div className="flex flex-col items-start gap-1 py-1">
      <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
        {t("tasksClear")}
      </p>
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {t("tasksClearHint")}
      </p>
    </div>
  );
}

/** Activity from notifications store — typed icons + source shortcuts. */
export function ActivityWidget() {
  const { t, unread: unreadLabel } = useShellT();
  const items = useNotificationsStore((s) => s.items);
  const markItemRead = useNotificationsStore((s) => s.markItemRead);
  const notifMuted = usePrefsStore((s) => s.notifMuted);
  const visible = items.filter((n) => {
    if (!isNotifSourceKey(n.source)) return true;
    return !notifMuted[n.source];
  });
  const unread = unreadCount(visible);
  const recent = visible.slice(0, 5);

  if (recent.length === 0) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {t("activityEmpty")}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[length:var(--a-text-xs)] text-a-fg-muted">
        {unread > 0 ? unreadLabel(unread) : t("activityUpToDate")}
      </p>
      <ul className="a-scroll-momentum max-h-[14rem] space-y-2 pr-0.5">
        {recent.map((n) => {
          const feed = iconForNotificationType(n.type);
          const href = resolveNotificationHref(n);
          return (
            <li key={n.id}>
              <Link
                href={href}
                onClick={() => markItemRead(n.id)}
                className="flex min-w-0 items-start gap-2.5 rounded-xl px-0.5 py-0.5 transition-opacity hover:opacity-90"
              >
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
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** AI panel — DISABLED with colored liquid logos + module shortcuts. */
export function AiPanelWidget() {
  const { t } = useShellT();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <FeedGlyph def={iconForAiRecommendation("generic")} size={15} />
        <div className="min-w-0">
          <p className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
            {t("aiAssistant")}
          </p>
          <p className="mt-0.5 text-[length:var(--a-text-xs)] text-a-fg-muted">
            État <span className="a-mono text-a-fg-subtle">{t("aiDisabled")}</span>{" "}
            — {t("aiDisabledHint")}
          </p>
        </div>
      </div>
      <ul className="a-scroll-momentum max-h-[12rem] space-y-1.5">
        {AI_REC_PLACEHOLDERS.map((row) => {
          const feed = iconForAiRecommendation(row.kind);
          return (
            <li key={row.kind}>
              <Link
                href={row.href}
                className="flex items-center gap-2.5 rounded-xl bg-a-surface-3/50 px-2 py-1.5 transition-opacity hover:opacity-95"
              >
                <FeedGlyph def={feed} size={13} />
                <span className="min-w-0 truncate text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {row.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bank treasury — counts always; GL balance only if Prefs accounting.gl.bank set (D197). */
export function TreasuryWidget() {
  const { t } = useShellT();
  const [data, setData] = useState<BankTreasury | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchBankTreasury();
      if (cancelled) return;
      if (!res.ok) {
        setError(res.message);
        setData(null);
      } else {
        setData(res.data);
        setError(null);
      }
      setPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (pending) return <ASkeleton lines={4} />;
  if (error || !data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {error ?? t("kpiUnavailable")}
      </p>
    );
  }

  const cells: Array<{ label: string; value: string }> = [
    { label: t("treasuryAccounts"), value: String(data.accountCount) },
    { label: t("treasuryUnmatched"), value: String(data.unmatchedCount) },
    { label: t("treasuryMatched"), value: String(data.matchedCount) },
    { label: t("treasuryIgnored"), value: String(data.ignoredCount) },
  ];

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div key={c.label}>
            <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
              {c.label}
            </dt>
            <dd className="a-mono mt-0.5 text-[length:var(--a-text-lg)] a-tabular text-a-fg">
              {c.value}
            </dd>
          </div>
        ))}
      </dl>
      {data.balancesVisible && data.glBankBalance != null ? (
        <p className="text-[length:var(--a-text-sm)] text-a-fg">
          {t("treasuryGlBalance")}
          {data.glBankCode ? (
            <span className="a-mono text-a-fg-muted"> · {data.glBankCode}</span>
          ) : null}
          <span className="a-mono ml-2 a-tabular font-medium">
            {data.glBankBalance} {data.currency}
          </span>
        </p>
      ) : (
        <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
          {t("treasuryGlHidden")}
          {data.balanceHideReason ? ` — ${data.balanceHideReason}` : null}
        </p>
      )}
      <Link
        href="/finance/banking"
        className="inline-flex text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
      >
        {t("treasuryOpenBanking")}
      </Link>
    </div>
  );
}

/** Backup status — live dashboard counts when module selected (D310). */
export function BackupStatusWidget() {
  const { t, locale } = useShellT();
  const [data, setData] = useState<{
    last: string;
    open: number;
    auto: string;
    total: number;
    restorable: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchBackupDashboard();
      if (cancelled) return;
      if (!res.data) {
        setError(res.message ?? t("kpiUnavailable"));
        setData(null);
      } else {
        const d = res.data;
        const last = d.lastBackup
          ? `${d.lastBackup.label ?? d.lastBackup.id.slice(0, 8)} · ${d.lastBackup.scope}`
          : "—";
        const auto = d.schedule?.autoBackup.enabled
          ? `H${d.schedule.autoBackup.hourTunis}`
          : "off";
        setData({
          last,
          open: d.openRestoreRequests ?? 0,
          auto,
          total: d.counts.total,
          restorable: d.counts.restorable,
        });
        setError(null);
      }
      setPending(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [t, locale]);

  if (pending) return <ASkeleton lines={4} />;
  if (error || !data) {
    return (
      <p className="text-[length:var(--a-text-sm)] text-a-fg-muted">
        {error ?? t("kpiUnavailable")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {t("kpiBackupTotal")}
          </dt>
          <dd className="a-mono mt-0.5 text-[length:var(--a-text-lg)] a-tabular text-a-fg">
            {data.total}
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {t("kpiBackupRestorable")}
          </dt>
          <dd className="a-mono mt-0.5 text-[length:var(--a-text-lg)] a-tabular text-a-fg">
            {data.restorable}
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {t("backupOpenRestores")}
          </dt>
          <dd className="a-mono mt-0.5 text-[length:var(--a-text-lg)] a-tabular text-a-fg">
            {data.open}
          </dd>
        </div>
        <div>
          <dt className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-wider text-a-fg-subtle">
            {t("backupAutoSchedule")}
          </dt>
          <dd className="a-mono mt-0.5 text-[length:var(--a-text-sm)] text-a-fg">
            {data.auto}
          </dd>
        </div>
      </dl>
      <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
        {t("backupLastLabel")}
        <span className="a-mono ml-1 text-a-fg">{data.last}</span>
      </p>
      <Link
        href="/backup"
        className="inline-flex text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
      >
        {t("backupOpenModule")}
      </Link>
    </div>
  );
}

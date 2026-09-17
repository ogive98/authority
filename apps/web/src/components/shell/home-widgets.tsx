"use client";

import Link from "next/link";
import {
  fetchBusinessMeClient,
  initialsFromName,
} from "@/lib/business-auth";
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
import { useHomeKpis } from "@/hooks/use-home-kpis";
import { useShellT } from "@/stores/locale-store";
import { fetchBankTreasury, type BankTreasury } from "@/lib/finance";

function greetingForHour(
  h: number,
  t: (key: import("@/stores/locale-store").ShellMessageKey) => string,
): string {
  if (h < 12) return t("greetMorning");
  if (h < 18) return t("greetAfternoon");
  return t("greetEvening");
}

/** Hero — identity from /me only (no fake KPI). D294 greeting. */
export function HeroContextWidget() {
  const { t } = useShellT();
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

  if (pending) return <ASkeleton lines={2} />;

  const hour = new Date().getHours();
  const greet = greetingForHour(hour, t);
  const display = name ?? t("operatorFallback");
  const initials = initialsFromName(display, "");

  return (
    <div className="a-card flex flex-wrap items-end justify-between gap-4 p-4 md:p-5">
      <div className="min-w-0">
        <h2 className="text-[length:var(--a-text-xl)] font-medium tracking-[-0.02em] text-a-fg">
          {greet}, {display.split(" ")[0]}
        </h2>
        <p className="mt-1 text-[length:var(--a-text-sm)] text-a-fg-muted">
          {role ?? t("accountFallback")}
          <span className="text-a-fg-subtle"> · </span>
          <span className="a-mono text-a-fg-subtle">{initials}</span>
        </p>
      </div>
      <Link
        href="/account"
        className="rounded-[var(--a-radius-sm)] bg-a-accent-muted px-3 py-1.5 text-[length:var(--a-text-xs)] font-medium text-a-accent transition-colors hover:bg-a-accent hover:text-a-accent-fg"
      >
        {t("controlCenter")}
      </Link>
    </div>
  );
}

/** Shell status from Thunder monitor — no CPU/RAM resource chrome. */
export function ShellStatusWidget() {
  const { t } = useShellT();
  const q = useMonitorSnapshot();
  if (q.isPending) return <ASkeleton lines={4} />;
  if (q.isError || !q.data) {
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
                  className="group flex items-center gap-2.5 rounded-xl px-2 py-2 text-[length:var(--a-text-sm)] text-a-fg transition-colors hover:bg-a-surface-3"
                >
                  <span
                    className={cn(
                      "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--a-radius-sm)] bg-a-accent-muted",
                      personalityForFeature(f.id, f.label).colorClass,
                    )}
                    aria-hidden
                  >
                    {(() => {
                      const Icon = resolveFeatureIcon(f.id, f.label);
                      return <Icon className="h-4 w-4" strokeWidth={1.75} />;
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
            <dd className="a-mono mt-0.5 text-[length:var(--a-text-lg)] tabular-nums text-a-fg">
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
          <span className="a-mono ml-2 tabular-nums font-medium">
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

const KPI_LABEL_KEYS: Record<
  import("@/lib/home-kpis").HomeKpiId,
  import("@/stores/locale-store").ShellMessageKey
> = {
  arOpen: "kpiArOpen",
  ordersActive: "kpiOrders",
  ordersDraft: "kpiOrdersDraft",
  ordersConfirmed: "kpiOrdersConfirmed",
  stockLines: "kpiStock",
  stockBalances: "kpiStockBalances",
  stockLots: "kpiStockLots",
  overdue: "kpiOverdue",
  shipmentsActive: "kpiShipmentsActive",
  shipmentsReady: "kpiShipmentsReady",
  shipmentsOut: "kpiShipmentsOut",
  moduleFeatures: "kpiModuleFeatures",
};

/** Live KPI strip — scoped to selected module (D168/D294). Live values only. */
export function HomeKpiStrip() {
  const { t } = useShellT();
  const q = useHomeKpis();

  if (q.isPending && !q.data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="a-card flex min-h-[7.5rem] flex-col justify-between rounded-[var(--a-radius-md)] p-4"
          >
            <ASkeleton className="h-3 w-24" />
            <ASkeleton className="h-8 w-32" />
            <ASkeleton className="h-3 w-40" />
          </div>
        ))}
      </div>
    );
  }

  const cards = q.data ?? [];
  if (cards.length === 0) return null;

  const cols =
    cards.length === 1
      ? "sm:grid-cols-1 max-w-sm"
      : cards.length === 2
        ? "sm:grid-cols-2"
        : cards.length === 3
          ? "sm:grid-cols-2 xl:grid-cols-3"
          : "sm:grid-cols-2 xl:grid-cols-4";

  return (
    <div className={cn("grid gap-3", cols)}>
      {cards.map((card) => {
        const label = t(KPI_LABEL_KEYS[card.id]);
        const muted = card.state !== "ok";
        const hint =
          card.state === "ok"
            ? null
            : card.state === "module_off"
              ? t("kpiModuleOff")
              : card.state === "forbidden"
                ? t("kpiForbidden")
                : card.state === "empty"
                  ? t("kpiEmptyModule")
                  : t("kpiUnavailable");
        return (
          <Link
            key={card.id}
            href={card.href}
            className="a-card a-stagger-in flex min-h-[7.5rem] flex-col justify-between p-4 transition-colors hover:bg-a-surface-3/50"
          >
            <p className="text-[length:var(--a-text-xs)] font-medium uppercase tracking-[0.08em] text-a-fg-muted">
              {label}
            </p>
            <div>
              <p
                className={cn(
                  "a-mono a-tabular text-[length:var(--a-text-2xl)] font-medium tracking-tight",
                  muted ? "text-a-fg-subtle" : "text-a-fg",
                )}
              >
                {card.value}
              </p>
              {hint ? (
                <p className="mt-1 text-[length:var(--a-text-xs)] text-a-fg-muted">
                  {hint}
                </p>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

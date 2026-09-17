"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Package,
  PanelRightClose,
  PanelRightOpen,
  PlusCircle,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { resolveDockActions, type ActionDefinition } from "@/lib/action-registry";
import { getFeatureMetadata } from "@/lib/feature-metadata";
import { resolvePinnedSmartActions } from "@/lib/smart-actions-pins";
import { useMeGrants } from "@/hooks/use-me-grants";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import {
  usePrefsStore,
  type Density,
  type SurfaceMode,
} from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";
import { useLocaleStore, useShellT } from "@/stores/locale-store";
import { cn } from "@/lib/utils";
import {
  personalityForFeature,
  resolveFeatureIcon,
} from "./icon-personality";

const SURFACES: { id: SurfaceMode; label: string }[] = [
  { id: "patch", label: "Patch" },
  { id: "ghost", label: "Ghost" },
  { id: "solid", label: "Solid" },
  { id: "minimal", label: "Min" },
];

const DENSITIES: { id: Density; label: string }[] = [
  { id: "comfortable", label: "Comfort" },
  { id: "compact", label: "Compact" },
  { id: "spacious", label: "Spacious" },
];

const SIDEBAR_STROKE = 1.5;

function dockIconFor(action: ActionDefinition): LucideIcon {
  const fromFeature = resolveFeatureIcon(action.id, action.label);
  if (fromFeature) return fromFeature;
  const hay = `${action.id} ${action.moduleId ?? ""} ${action.href ?? ""}`.toLowerCase();
  if (/sales|order|commande/.test(hay)) return ShoppingCart;
  if (/product|sku|catalogue/.test(hay)) return Package;
  if (/customer|client|party|hr|user/.test(hay)) return Users;
  if (/invent|stock|lot/.test(hay)) return Package;
  if (/ai|intel|spark/.test(hay)) return Sparkles;
  if (/home|nav-home|dashboard/.test(hay)) return Zap;
  return PlusCircle;
}

function WifiIndicator({ online }: { online: boolean }) {
  const { t } = useShellT();
  const [phase, setPhase] = useState<"scan" | "ready">("scan");

  useEffect(() => {
    setPhase("scan");
    const id = window.setTimeout(() => setPhase("ready"), 1400);
    return () => window.clearTimeout(id);
  }, []);

  if (phase === "scan") {
    return (
      <span
        className="inline-flex items-center justify-center text-a-fg-subtle"
        title={t("wifiScanning")}
      >
        <Wifi className="h-4 w-4 animate-pulse" strokeWidth={SIDEBAR_STROKE} />
      </span>
    );
  }

  if (!online) {
    return (
      <span
        className="inline-flex items-center justify-center text-[var(--a-danger)]"
        title={t("wifiOffline")}
      >
        <WifiOff className="h-4 w-4" strokeWidth={SIDEBAR_STROKE} />
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center text-[var(--a-success)]"
      title={t("wifiOnline")}
    >
      <Wifi className="h-4 w-4" strokeWidth={SIDEBAR_STROKE} />
    </span>
  );
}

/** Sync arrows only — no surrounding disc (D294). */
function SyncGlyph({ active }: { active: boolean }) {
  const { t } = useShellT();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        active ? "text-a-accent" : "text-a-fg-muted",
      )}
      title={active ? t("syncActive") : t("syncIdle")}
    >
      <RefreshCw
        className={cn("h-4 w-4", active && "animate-spin")}
        strokeWidth={SIDEBAR_STROKE}
      />
    </span>
  );
}

/** Compact iOS-like resource ring. */
function ResourceGauge({
  label,
  ratio,
  detail,
}: {
  label: string;
  ratio: number | null;
  detail?: string;
}) {
  const pct = ratio == null ? null : Math.max(0, Math.min(100, Math.round(ratio * 100)));
  const r = 15;
  const c = 2 * Math.PI * r;
  const dash = pct == null ? 0 : (pct / 100) * c;
  const hot = pct != null && pct >= 85;

  return (
    <div
      className="flex flex-col items-center gap-1"
      title={detail ?? (pct != null ? `${label} ${pct}%` : label)}
    >
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-a-surface-4"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 20 20)"
          className={cn(
            "transition-[stroke-dasharray] duration-500",
            hot ? "text-a-warning" : "text-a-accent",
          )}
        />
        <text
          x="20"
          y="21.5"
          textAnchor="middle"
          fill="var(--a-fg)"
          style={{ fontSize: 8, fontWeight: 600 }}
        >
          {pct == null ? "—" : pct}
        </text>
      </svg>
      <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
        {label}
      </span>
    </div>
  );
}

function ThunderBoltIcon({ className }: { className?: string }) {
  return (
    <span className={cn("a-thunder-bolt relative inline-flex", className)} aria-hidden>
      <Zap
        className="a-thunder-bolt__icon h-5 w-5 text-a-accent"
        strokeWidth={1.75}
        fill="currentColor"
        fillOpacity={0.28}
      />
      <span className="a-thunder-bolt__flash" />
    </span>
  );
}

function ThunderCoreDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useShellT();
  const surfaceMode = usePrefsStore((s) => s.surfaceMode);
  const setSurfaceMode = usePrefsStore((s) => s.setSurfaceMode);
  const density = usePrefsStore((s) => s.density);
  const setDensity = usePrefsStore((s) => s.setDensity);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-black/40" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-[var(--a-z-modal)] w-[min(22.5rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 outline-none",
            "rounded-[var(--a-radius-lg)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 p-6",
            "shadow-[var(--a-shadow-panel)]",
          )}
        >
          <Dialog.Title className="flex items-center gap-2.5 text-[length:var(--a-text-lg)] font-medium tracking-[-0.02em] text-a-fg">
            <ThunderBoltIcon />
            {t("thunderCore")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-snug text-a-fg-muted">
            {t("thunderCoreHint")}
          </Dialog.Description>

          <div className="mt-5 space-y-5">
            <Link
              href="/thunder"
              onClick={() => onOpenChange(false)}
              className="a-action-primary flex w-full items-center justify-center gap-2 rounded-[var(--a-radius-sm)] px-3.5 py-3 text-[14px] font-medium"
            >
              <Zap className="h-4 w-4" strokeWidth={1.75} />
              Command Center
            </Link>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
                {t("surface")}
              </p>
              <div className="grid grid-cols-4 gap-1.5 rounded-[var(--a-radius-md)] bg-a-surface-3/70 p-1.5">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSurfaceMode(s.id)}
                    className={cn(
                      "a-action-quiet rounded-[var(--a-radius-sm)] px-1 py-2.5 text-[11px] font-medium",
                      surfaceMode === s.id && "is-active text-a-fg",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-a-fg-subtle">
                {t("density")}
              </p>
              <div className="grid grid-cols-3 gap-1.5 rounded-[var(--a-radius-md)] bg-a-surface-3/70 p-1.5">
                {DENSITIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDensity(d.id)}
                    className={cn(
                      "a-action-quiet rounded-[var(--a-radius-sm)] px-1 py-2.5 text-[11px] font-medium",
                      density === d.id && "is-active text-a-fg",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Dialog.Close className="a-action-primary mt-5 w-full px-3 py-3 text-[15px] font-medium">
            {t("close")}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ActionTile({
  action,
  collapsed,
}: {
  action: ActionDefinition;
  collapsed: boolean;
}) {
  const locale = useLocaleStore((s) => s.locale);
  if (!action.href) return null;
  const Icon = dockIconFor(action);
  const meta = getFeatureMetadata(
    action.id.startsWith("nav-") ? action.id : `nav-${action.moduleId ?? ""}`,
    locale,
  );
  const tags = meta?.tags?.slice(0, 2) ?? [];
  const personality = personalityForFeature(action.id, action.label);
  const shortcut = action.shortcut
    ? action.shortcut.keys.join("+")
    : null;

  if (collapsed) {
    return (
      <Link
        href={action.href}
        title={action.label}
        className="a-nav-row inline-flex h-10 w-10 items-center justify-center rounded-[var(--a-radius-sm)] text-a-accent"
      >
        <Icon
          className={cn("h-4 w-4", personality.colorClass)}
          strokeWidth={SIDEBAR_STROKE}
          aria-hidden
        />
      </Link>
    );
  }

  return (
    <Link
      href={action.href}
      className="a-nav-row group flex w-full items-center gap-2.5 rounded-[var(--a-radius-sm)] px-1.5 py-1.5 text-left"
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", personality.colorClass)}
        strokeWidth={SIDEBAR_STROKE}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium tracking-[-0.015em] text-a-fg-muted group-hover:text-a-fg">
          {action.label}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1">
          {shortcut ? (
            <span className="a-mono text-[10px] text-a-fg-subtle">{shortcut}</span>
          ) : null}
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-[4px] bg-a-surface-3 px-1 py-px text-[9px] font-medium tracking-wide text-a-fg-subtle"
            >
              {tag}
            </span>
          ))}
          {meta?.entity ? (
            <span className="a-mono text-[9px] text-a-fg-subtle">
              {meta.entity}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}

/**
 * Smart Action Dock — pinned features · gauges · Thunder (D294).
 */
export function SmartActionDock() {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const dockCollapsed = useShellStore((s) => s.dockCollapsed);
  const setDockCollapsed = useShellStore((s) => s.setDockCollapsed);
  const dockMobileOpen = useShellStore((s) => s.dockMobileOpen);
  const setDockMobileOpen = useShellStore((s) => s.setDockMobileOpen);
  const smartActionIds = usePrefsStore((s) => s.smartActionIds);
  const { data: registry } = useMeRegistry();
  const { grants } = useMeGrants();
  const locale = useLocaleStore((s) => s.locale);
  const monitor = useMonitorSnapshot();
  const panelId = useId();
  const [thunderOpen, setThunderOpen] = useState(false);
  const [netOnline, setNetOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    function onOnline() {
      setNetOnline(true);
    }
    function onOffline() {
      setNetOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const unique = useMemo(() => {
    const pinned = resolvePinnedSmartActions(registry, smartActionIds, locale);
    if (pinned.length > 0) return pinned;
    const { primary, shortcuts } = resolveDockActions(
      registry,
      selectedModuleId,
      5,
      locale,
      grants,
    );
    const tiles = [primary, ...shortcuts].filter(Boolean) as ActionDefinition[];
    return tiles.filter(
      (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
    );
  }, [registry, smartActionIds, selectedModuleId, locale, grants]);

  const snap = monitor.data;
  const platformOk = !!(snap?.db.ok && snap?.redis.ok && netOnline);
  const syncing =
    monitor.isFetching ||
    (snap != null && (snap.jobs.running > 0 || snap.pressure.shedP4));
  const jobsRatio =
    snap == null
      ? null
      : Math.min(
          1,
          (snap.jobs.running + snap.jobs.pending) /
            Math.max(1, snap.jobs.running + snap.jobs.pending + 4),
        );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "/") return;
      e.preventDefault();
      setDockMobileOpen(!useShellStore.getState().dockMobileOpen);
      setDockCollapsed(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setDockCollapsed, setDockMobileOpen]);

  const body = (
    <div
      className={cn(
        "a-ios-scroll flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3",
        dockCollapsed && "items-center px-1.5",
      )}
    >
      <div
        className={cn(
          "flex gap-2",
          dockCollapsed ? "flex-col items-center" : "items-start justify-between",
        )}
      >
        <div className="min-w-0 flex-1 space-y-3">
          <div
            className={cn(
              "flex items-center gap-2",
              dockCollapsed && "flex-col gap-2",
            )}
            title={platformOk ? t("online") : t("wifiOffline")}
          >
            <WifiIndicator online={platformOk} />
            <SyncGlyph active={syncing} />
          </div>

          {!dockCollapsed ? (
            <div
              className="grid grid-cols-3 gap-2 rounded-[var(--a-radius-md)] bg-a-surface-3/55 px-2 py-2.5"
              aria-label={t("resources")}
            >
              <ResourceGauge
                label="CPU"
                ratio={snap?.cpu.usageRatio ?? null}
              />
              <ResourceGauge
                label="RAM"
                ratio={snap?.ram.usageRatio ?? null}
              />
              <ResourceGauge
                label="Jobs"
                ratio={jobsRatio}
                detail={
                  snap
                    ? `${snap.jobs.running}/${snap.jobs.pending}`
                    : undefined
                }
              />
            </div>
          ) : snap ? (
            <ResourceGauge
              label="CPU"
              ratio={snap.cpu.usageRatio ?? null}
            />
          ) : null}
        </div>
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
          aria-label={dockCollapsed ? t("expandDock") : t("collapseDock")}
          onClick={() => setDockCollapsed(!dockCollapsed)}
        >
          {dockCollapsed ? (
            <PanelRightOpen className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <PanelRightClose className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>

      {!dockCollapsed ? (
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-a-accent">
          {t("smartActions")}
        </p>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-0.5",
          dockCollapsed && "items-center",
        )}
      >
        {unique.length === 0 && !dockCollapsed ? (
          <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
            {t("kpiEmpty")}
          </p>
        ) : (
          unique.map((a) => (
            <ActionTile key={a.id} action={a} collapsed={dockCollapsed} />
          ))
        )}
      </div>

      <div className="mt-auto">
        {!dockCollapsed ? (
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-a-fg-subtle">
            {t("system")}
          </p>
        ) : null}
        <ul className={cn(dockCollapsed && "flex flex-col items-center")}>
          <li>
            <button
              type="button"
              onClick={() => setThunderOpen(true)}
              className={cn(
                "a-nav-row flex w-full items-center gap-2.5 rounded-md px-1.5 py-1.5 text-left text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg",
                dockCollapsed && "justify-center px-0.5",
              )}
              aria-label={t("thunderCoreOpen")}
            >
              <ThunderBoltIcon />
              {!dockCollapsed ? (
                <span className="truncate text-[12.5px] font-medium">
                  {t("thunderCore")}
                </span>
              ) : null}
            </button>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <aside
        id={panelId}
        aria-label={t("smartActions")}
        className={cn(
          "relative hidden h-full shrink-0 flex-col border-l border-[color:var(--a-border-subtle)] bg-a-surface-2 md:flex",
          "transition-[width] duration-200 ease-out",
          dockCollapsed ? "w-[3.5rem]" : "w-[16.5rem]",
        )}
      >
        {body}
      </aside>

      <ThunderCoreDialog open={thunderOpen} onOpenChange={setThunderOpen} />

      <button
        type="button"
        className="fixed right-4 bottom-20 z-[var(--a-z-sticky)] inline-flex h-12 w-12 items-center justify-center rounded-[var(--a-radius-sm)] border border-[color:var(--a-border-subtle)] bg-a-surface-2 text-a-accent shadow-[var(--a-shadow-card)] md:hidden"
        aria-label={t("smartActions")}
        aria-expanded={dockMobileOpen}
        onClick={() => setDockMobileOpen(!dockMobileOpen)}
      >
        <ThunderBoltIcon />
      </button>

      {dockMobileOpen ? (
        <div className="fixed inset-0 z-[var(--a-z-modal)] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t("close")}
            onClick={() => setDockMobileOpen(false)}
          />
          <div className="a-card absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-hidden rounded-t-[var(--a-radius-lg)] border-t border-[color:var(--a-border-subtle)] shadow-[var(--a-shadow-panel)]">
            <MobileDockBody onClose={() => setDockMobileOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}

function MobileDockBody({ onClose }: { onClose: () => void }) {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const smartActionIds = usePrefsStore((s) => s.smartActionIds);
  const { data: registry } = useMeRegistry();
  const { grants } = useMeGrants();
  const locale = useLocaleStore((s) => s.locale);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const tiles = useMemo(() => {
    const pinned = resolvePinnedSmartActions(registry, smartActionIds, locale);
    if (pinned.length > 0) return pinned;
    const { primary, shortcuts } = resolveDockActions(
      registry,
      selectedModuleId,
      8,
      locale,
      grants,
    );
    return [primary, ...shortcuts].filter(Boolean) as ActionDefinition[];
  }, [registry, smartActionIds, selectedModuleId, locale, grants]);

  if (!mounted) return null;

  return (
    <div className="a-ios-scroll flex max-h-[75dvh] flex-col gap-2 overflow-y-auto p-4 pb-8">
      <div className="mx-auto mb-1 h-1 w-10 rounded-sm bg-a-surface-4" />
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-a-fg-subtle">
        {t("smartActions")}
      </p>
      {tiles.map((a) =>
        a.href ? (
          <ActionTile key={a.id} action={a} collapsed={false} />
        ) : null,
      )}
      <button
        type="button"
        className="mt-2 rounded-md bg-a-surface-3 px-3 py-2 text-[length:var(--a-text-sm)] text-a-fg"
        onClick={onClose}
      >
        {t("close")}
      </button>
    </div>
  );
}

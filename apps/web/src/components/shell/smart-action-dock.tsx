"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Package,
  PanelRightClose,
  PanelRightOpen,
  PlusCircle,
  RefreshCw,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { resolveDockActions, type ActionDefinition } from "@/lib/action-registry";
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
      className="inline-flex items-center justify-center text-[var(--a-success)] drop-shadow-[0_0_6px_var(--a-success)]"
      title={t("wifiOnline")}
    >
      <Wifi className="h-4 w-4" strokeWidth={SIDEBAR_STROKE} />
    </span>
  );
}

/** Single sync circle (RefreshCw) — D184. */
function SyncCircle({ active }: { active: boolean }) {
  const { t } = useShellT();
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full",
        active ? "bg-a-accent-muted text-a-accent" : "text-a-fg-muted",
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
        <Dialog.Overlay className="fixed inset-0 z-[var(--a-z-modal)] bg-black/25 backdrop-blur-[18px]" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-[var(--a-z-modal)] w-[min(22.5rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 outline-none",
            "rounded-[var(--a-radius-lg)] p-6",
            "bg-[color-mix(in_srgb,var(--a-surface-2)_88%,transparent)]",
            "shadow-[0_24px_80px_rgb(0_0_0/0.35),0_0_0_0.5px_rgb(255_255_255/0.12)_inset]",
            "backdrop-blur-[40px] saturate-[180%]",
          )}
        >
          <Dialog.Title className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] text-a-fg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--a-radius-sm)] bg-a-accent/20 text-a-accent">
              <Zap
                className="h-4 w-4"
                strokeWidth={2}
                fill="currentColor"
                fillOpacity={0.35}
              />
            </span>
            {t("thunderCore")}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-snug text-a-fg-muted">
            {t("thunderCoreHint")}
          </Dialog.Description>

          <div className="mt-5 space-y-5">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-a-fg-subtle">
                {t("surface")}
              </p>
              <div className="grid grid-cols-4 gap-1.5 rounded-[var(--a-radius-md)] bg-a-surface-3/70 p-1.5">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSurfaceMode(s.id)}
                    className={cn(
                      "a-action-quiet rounded-[var(--a-radius-sm)] px-1 py-2.5 text-[11px] font-semibold",
                      surfaceMode === s.id && "is-active text-a-fg",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-a-fg-subtle">
                {t("density")}
              </p>
              <div className="grid grid-cols-3 gap-1.5 rounded-[var(--a-radius-md)] bg-a-surface-3/70 p-1.5">
                {DENSITIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDensity(d.id)}
                    className={cn(
                      "a-action-quiet rounded-[var(--a-radius-sm)] px-1 py-2.5 text-[11px] font-semibold",
                      density === d.id && "is-active text-a-fg",
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <Link
              href="/settings#apparence"
              onClick={() => onOpenChange(false)}
              className="a-action-quiet flex w-full items-center gap-2 rounded-[var(--a-radius-sm)] px-3.5 py-3 text-[14px]"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.5} />
              {t("preferences")}
            </Link>
          </div>

          <Dialog.Close className="a-action-primary mt-5 w-full px-3 py-3 text-[15px] font-semibold">
            {t("close")}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const DOCK_SPARK = ["text-a-accent"] as const;

function ActionTile({
  action,
  collapsed,
  sparkIndex = 0,
}: {
  action: ActionDefinition;
  collapsed: boolean;
  sparkIndex?: number;
}) {
  if (!action.href) return null;
  const Icon = dockIconFor(action);
  const shortcut = action.shortcut
    ? action.shortcut.keys.join("+")
    : null;
  const spark = DOCK_SPARK[sparkIndex % DOCK_SPARK.length];

  if (collapsed) {
    return (
      <Link
        href={action.href}
        title={action.label}
        className={cn(
          "a-nav-row inline-flex h-10 w-10 items-center justify-center rounded-[var(--a-radius-sm)]",
          spark,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={SIDEBAR_STROKE} aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={action.href}
      className="a-nav-row group flex w-full items-center gap-2.5 rounded-[var(--a-radius-sm)] px-1.5 py-1.5 text-left"
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", spark)}
        strokeWidth={SIDEBAR_STROKE}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium tracking-[-0.015em] text-a-fg-muted group-hover:text-a-fg">
          {action.label}
        </span>
        {shortcut ? (
          <span className="a-mono text-[10px] text-a-fg-subtle">{shortcut}</span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * Smart Action Dock — shortcuts · system (wifi/sync/Thunder) (D167).
 */
export function SmartActionDock() {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const dockCollapsed = useShellStore((s) => s.dockCollapsed);
  const setDockCollapsed = useShellStore((s) => s.setDockCollapsed);
  const dockMobileOpen = useShellStore((s) => s.dockMobileOpen);
  const setDockMobileOpen = useShellStore((s) => s.setDockMobileOpen);
  const { data: registry } = useMeRegistry();
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

  const { primary, shortcuts } = resolveDockActions(
    registry,
    selectedModuleId,
    5,
    locale,
  );
  const tiles = [primary, ...shortcuts].filter(Boolean) as ActionDefinition[];
  const unique = tiles.filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
  );

  const snap = monitor.data;
  const platformOk = !!(snap?.db.ok && snap?.redis.ok && netOnline);
  const syncing =
    monitor.isFetching ||
    (snap != null && (snap.jobs.running > 0 || snap.pressure.shedP4));

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
        "flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3",
        dockCollapsed && "items-center px-1.5",
      )}
    >
      <div
        className={cn(
          "flex gap-2",
          dockCollapsed ? "flex-col items-center" : "items-start justify-between",
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div
            className={cn(
              "flex items-center gap-2",
              dockCollapsed && "flex-col gap-2",
            )}
            title={platformOk ? t("online") : t("wifiOffline")}
          >
            <WifiIndicator online={platformOk} />
            {!dockCollapsed ? (
              <span
                className={cn(
                  "text-[11px] font-medium",
                  platformOk ? "text-a-success-fg" : "text-a-danger",
                )}
              >
                {t("online")}
              </span>
            ) : null}
            <SyncCircle active={syncing} />
          </div>
          {!dockCollapsed && snap ? (
            <p className="a-mono text-[10px] text-a-fg-subtle">
              CPU {Math.round((snap.cpu.usageRatio ?? 0) * 100)}% · RAM{" "}
              {Math.round(snap.ram.usageRatio * 100)}% · Jobs{" "}
              {snap.jobs.running}/{snap.jobs.pending}
            </p>
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-a-accent">
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
          unique.map((a, i) => (
            <ActionTile
              key={a.id}
              action={a}
              collapsed={dockCollapsed}
              sparkIndex={i}
            />
          ))
        )}
      </div>

      <div>
        {!dockCollapsed ? (
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-a-fg-subtle">
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
              <Zap
                className="h-5 w-5 shrink-0 text-a-accent"
                strokeWidth={SIDEBAR_STROKE}
              />
              {!dockCollapsed ? (
                <span className="truncate text-[12.5px] font-medium">
                  {t("thunderCore")}
                </span>
              ) : null}
            </button>
          </li>
        </ul>
      </div>

      {!dockCollapsed ? (
        <div className="mt-auto pt-1">
          <Link
            href="/settings#apparence"
            className="a-nav-row flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-[12.5px] font-medium text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
          >
            <Settings2
              className="h-5 w-5 shrink-0 text-a-accent"
              strokeWidth={SIDEBAR_STROKE}
            />
            {t("preferences")}
          </Link>
        </div>
      ) : (
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            href="/settings#apparence"
            aria-label={t("preferences")}
            className="a-nav-row inline-flex h-10 w-10 items-center justify-center rounded-[var(--a-radius-sm)] text-a-accent"
          >
            <Settings2 className="h-5 w-5" strokeWidth={SIDEBAR_STROKE} />
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        id={panelId}
        aria-label={t("smartActions")}
        className={cn(
          "a-glass relative hidden h-full shrink-0 flex-col md:flex",
          "transition-[width] duration-200 ease-out",
          dockCollapsed ? "w-[3.5rem]" : "w-[16.5rem]",
        )}
      >
        {body}
      </aside>

      <ThunderCoreDialog open={thunderOpen} onOpenChange={setThunderOpen} />

      <button
        type="button"
        className="a-glass fixed right-4 bottom-20 z-[var(--a-z-sticky)] inline-flex h-12 w-12 items-center justify-center rounded-md text-a-accent shadow-lg md:hidden"
        aria-label={t("smartActions")}
        aria-expanded={dockMobileOpen}
        onClick={() => setDockMobileOpen(!dockMobileOpen)}
      >
        <Zap className="h-5 w-5" strokeWidth={1.75} />
      </button>

      {dockMobileOpen ? (
        <div className="fixed inset-0 z-[var(--a-z-modal)] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label={t("close")}
            onClick={() => setDockMobileOpen(false)}
          />
          <div className="a-glass-strong absolute inset-x-0 bottom-0 max-h-[75dvh] overflow-hidden rounded-t-xl">
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
  const { data: registry } = useMeRegistry();
  const locale = useLocaleStore((s) => s.locale);
  const { primary, shortcuts } = resolveDockActions(
    registry,
    selectedModuleId,
    8,
    locale,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const tiles = [primary, ...shortcuts].filter(Boolean) as ActionDefinition[];

  return (
    <div className="flex max-h-[75dvh] flex-col gap-2 overflow-y-auto p-4 pb-8">
      <div className="mx-auto mb-1 h-1 w-10 rounded-sm bg-a-surface-4" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-a-fg-subtle">
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

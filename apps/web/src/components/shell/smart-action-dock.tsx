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

/** Teal family steps — same hue family as --a-accent, distinct per tile. */
const DOCK_TEAL_FAMILY = [
  {
    tile: "bg-[#0d9488] text-white hover:bg-[#0f766e]",
    iconWrap: "bg-white/20",
    glyph: "text-white",
    sub: "text-white/75",
    collapsed: "bg-[#0d9488] text-white",
  },
  {
    tile: "bg-[#14b8a6] text-white hover:bg-[#0d9488]",
    iconWrap: "bg-white/20",
    glyph: "text-white",
    sub: "text-white/75",
    collapsed: "bg-[#14b8a6] text-white",
  },
  {
    tile: "bg-[#2dd4bf] text-[#042f2e] hover:bg-[#5eead4]",
    iconWrap: "bg-[#042f2e]/12",
    glyph: "text-[#042f2e]",
    sub: "text-[#042f2e]/70",
    collapsed: "bg-[#2dd4bf] text-[#042f2e]",
  },
  {
    tile: "bg-[#5eead4] text-[#042f2e] hover:bg-[#99f6e4]",
    iconWrap: "bg-[#042f2e]/10",
    glyph: "text-[#042f2e]",
    sub: "text-[#042f2e]/65",
    collapsed: "bg-[#5eead4] text-[#042f2e]",
  },
  {
    tile: "bg-[color-mix(in_srgb,var(--a-accent)_28%,transparent)] text-a-fg hover:bg-[color-mix(in_srgb,var(--a-accent)_38%,transparent)]",
    iconWrap: "bg-a-accent/25 text-a-accent",
    glyph: "text-a-accent",
    sub: "text-a-fg-subtle",
    collapsed: "bg-a-accent-muted text-a-accent",
  },
  {
    tile: "bg-[color-mix(in_srgb,var(--a-accent)_16%,transparent)] text-a-fg hover:bg-[color-mix(in_srgb,var(--a-accent)_26%,transparent)]",
    iconWrap: "bg-a-accent/20 text-a-accent",
    glyph: "text-a-accent",
    sub: "text-a-fg-subtle",
    collapsed: "bg-a-accent-muted text-a-accent",
  },
] as const;

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

function StatusDot({
  ok,
  label,
  detail,
  leading,
}: {
  ok: boolean | null;
  label: string;
  detail?: string;
  leading?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2 text-[length:var(--a-text-xs)]">
      {leading ?? (
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-sm",
            ok == null
              ? "bg-a-fg-subtle"
              : ok
                ? "bg-[var(--a-success)] shadow-[0_0_8px_var(--a-success)]"
                : "bg-[var(--a-danger)]",
          )}
        />
      )}
      <span className="text-a-fg-muted">{label}</span>
      {detail ? (
        <span className="a-mono ml-auto text-a-fg-subtle">{detail}</span>
      ) : null}
    </li>
  );
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
        className="inline-flex items-center gap-1 text-a-fg-subtle"
        title={t("wifiScanning")}
      >
        <Wifi className="h-3.5 w-3.5 animate-pulse" strokeWidth={2} />
      </span>
    );
  }

  if (!online) {
    return (
      <span
        className="inline-flex text-[var(--a-danger)]"
        title={t("wifiOffline")}
      >
        <WifiOff className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }

  return (
    <span
      className="inline-flex text-[var(--a-success)] drop-shadow-[0_0_6px_var(--a-success)]"
      title={t("wifiOnline")}
    >
      <Wifi className="h-3.5 w-3.5" strokeWidth={2} />
    </span>
  );
}

function SyncArrows({ active }: { active: boolean }) {
  const { t } = useShellT();
  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={active ? t("syncActive") : t("syncIdle")}
    >
      <RefreshCw
        className={cn("h-3 w-3 text-a-accent", active && "animate-spin")}
        strokeWidth={2.25}
      />
      <RefreshCw
        className={cn(
          "h-3 w-3 text-sky-400",
          active && "animate-spin [animation-direction:reverse]",
        )}
        strokeWidth={2.25}
        style={active ? { animationDuration: "1.1s" } : undefined}
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
            "rounded-[28px] p-6",
            "bg-[color-mix(in_srgb,var(--a-surface-2)_88%,transparent)]",
            "shadow-[0_24px_80px_rgb(0_0_0/0.35),0_0_0_0.5px_rgb(255_255_255/0.12)_inset]",
            "backdrop-blur-[40px] saturate-[180%]",
          )}
        >
          <Dialog.Title className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em] text-a-fg">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-a-accent/20 text-a-accent">
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
              <div className="grid grid-cols-4 gap-1.5 rounded-[16px] bg-a-surface-3/70 p-1.5">
                {SURFACES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSurfaceMode(s.id)}
                    className={cn(
                      "rounded-[12px] px-1 py-2.5 text-[11px] font-semibold transition-all",
                      surfaceMode === s.id
                        ? "bg-[rgb(255_255_255/0.92)] text-[#0a1628] shadow-sm [data-theme=dark]:bg-[rgb(44_44_46/0.95)] [data-theme=dark]:text-a-fg"
                        : "text-a-fg-muted hover:text-a-fg",
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
              <div className="grid grid-cols-3 gap-1.5 rounded-[16px] bg-a-surface-3/70 p-1.5">
                {DENSITIES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDensity(d.id)}
                    className={cn(
                      "rounded-[12px] px-1 py-2.5 text-[11px] font-semibold transition-all",
                      density === d.id
                        ? "bg-[rgb(255_255_255/0.92)] text-[#0a1628] shadow-sm"
                        : "text-a-fg-muted hover:text-a-fg",
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
              className="flex items-center gap-2 rounded-[14px] bg-a-surface-3/50 px-3.5 py-3 text-[14px] text-a-fg-muted transition-colors hover:bg-a-surface-3 hover:text-a-fg"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.5} />
              {t("preferences")}
            </Link>
          </div>

          <Dialog.Close className="mt-5 w-full rounded-[14px] bg-a-accent px-3 py-3 text-[15px] font-semibold text-white shadow-md transition-opacity hover:opacity-90">
            {t("close")}
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ActionTile({
  action,
  index,
  collapsed,
}: {
  action: ActionDefinition;
  index: number;
  collapsed: boolean;
}) {
  if (!action.href) return null;
  const Icon = dockIconFor(action);
  const tone = DOCK_TEAL_FAMILY[index % DOCK_TEAL_FAMILY.length]!;
  const shortcut = action.shortcut
    ? action.shortcut.keys.join("+")
    : null;

  if (collapsed) {
    return (
      <Link
        href={action.href}
        title={action.label}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-md",
          tone.collapsed,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      href={action.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors",
        tone.tile,
      )}
    >
      <span
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          tone.iconWrap,
        )}
      >
        <Icon className={cn("h-4 w-4", tone.glyph)} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[length:var(--a-text-sm)] font-medium">
          {action.label}
        </span>
        {shortcut ? (
          <span className={cn("a-mono text-[10px]", tone.sub)}>
            {shortcut}
          </span>
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
          "flex items-center",
          dockCollapsed ? "justify-center" : "justify-between",
        )}
      >
        {!dockCollapsed ? (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-a-fg-subtle">
            {t("smartActions")}
          </p>
        ) : null}
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
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

      <div
        className={cn(
          "flex flex-col gap-1.5",
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
              index={i}
              collapsed={dockCollapsed}
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
        <ul
          className={cn(
            "space-y-2 rounded-md bg-a-surface-3/40 px-3 py-2.5",
            dockCollapsed && "flex flex-col items-center gap-2 px-1.5",
          )}
        >
          {dockCollapsed ? (
            <>
              <WifiIndicator online={platformOk} />
              <SyncArrows active={syncing} />
              <button
                type="button"
                aria-label={t("thunderCoreOpen")}
                onClick={() => setThunderOpen(true)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-a-accent hover:bg-a-surface-3"
              >
                <Zap
                  className="h-4 w-4"
                  strokeWidth={2}
                  fill="currentColor"
                  fillOpacity={0.3}
                />
              </button>
            </>
          ) : monitor.isPending ? (
            <li className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {t("loading")}
            </li>
          ) : (
            <>
              <StatusDot
                ok={platformOk}
                label={t("online")}
                detail={snap?.systemMode ?? (netOnline ? "ok" : "off")}
                leading={<WifiIndicator online={platformOk} />}
              />
              <StatusDot
                ok={!syncing || !snap?.pressure.shedP4}
                label={syncing ? t("syncActive") : t("syncIdle")}
                detail={
                  snap ? `${snap.jobs.running}/${snap.jobs.pending}` : "—"
                }
                leading={<SyncArrows active={syncing} />}
              />
              <li>
                <button
                  type="button"
                  onClick={() => setThunderOpen(true)}
                  className="flex w-full items-center gap-2 rounded-md px-0.5 py-0.5 text-left text-[length:var(--a-text-xs)] text-a-fg-muted transition-colors hover:text-a-fg"
                >
                  <Zap
                    className="h-3.5 w-3.5 shrink-0 text-a-accent"
                    strokeWidth={2}
                    fill="currentColor"
                    fillOpacity={0.3}
                  />
                  <span>{t("thunderCore")}</span>
                  <span className="a-mono ml-auto text-a-fg-subtle">···</span>
                </button>
              </li>
            </>
          )}
        </ul>
      </div>

      {!dockCollapsed ? (
        <div className="mt-auto pt-1">
          <Link
            href="/settings#apparence"
            className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[length:var(--a-text-sm)] text-a-fg-muted transition-colors hover:bg-a-surface-3 hover:text-a-fg"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
            {t("preferences")}
          </Link>
        </div>
      ) : (
        <div className="mt-auto flex flex-col items-center gap-2">
          <Link
            href="/settings#apparence"
            aria-label={t("preferences")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-a-fg-muted hover:bg-a-surface-3"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={1.5} />
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
      {tiles.map((a, i) =>
        a.href ? (
          <ActionTile
            key={a.id}
            action={a}
            index={i}
            collapsed={false}
          />
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

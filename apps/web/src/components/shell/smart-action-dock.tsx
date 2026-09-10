"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import {
  Package,
  PanelRightClose,
  PanelRightOpen,
  PlusCircle,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { resolveDockActions, type ActionDefinition } from "@/lib/action-registry";
import { useMeRegistry } from "@/hooks/use-me-registry";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import {
  usePrefsStore,
  type SurfaceMode,
} from "@/stores/prefs-store";
import { useShellStore } from "@/stores/shell-store";
import { useShellT } from "@/stores/locale-store";
import { cn } from "@/lib/utils";

const SURFACES: { id: SurfaceMode; label: string }[] = [
  { id: "patch", label: "Patch" },
  { id: "ghost", label: "Ghost" },
  { id: "solid", label: "Solid" },
  { id: "minimal", label: "Min" },
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

/** Coherent teal dock — one family shade per shortcut. */
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

function ResourceBar({
  label,
  ratio,
}: {
  label: string;
  ratio: number | null;
}) {
  const pct =
    ratio == null ? null : Math.max(0, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-a-fg-subtle">{label}</span>
        <span className="a-mono text-a-fg-muted">
          {pct == null ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-a-surface-4">
        <div
          className="h-full rounded-sm bg-a-accent transition-all duration-700"
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function StatusDot({
  ok,
  label,
  detail,
}: {
  ok: boolean | null;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-center gap-2 text-[length:var(--a-text-xs)]">
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
      <span className="text-a-fg-muted">{label}</span>
      <span className="a-mono ml-auto text-a-fg-subtle">{detail}</span>
    </li>
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
          "flex h-9 w-9 items-center justify-center rounded-md transition-transform hover:scale-105",
          tone.collapsed,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </Link>
    );
  }

  return (
    <Link
      href={action.href}
      className={cn(
        "group flex items-center gap-3 rounded-md p-2.5 transition-colors duration-150",
        tone.tile,
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          tone.iconWrap,
          tone.glyph,
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold tracking-[-0.01em]">
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
 * Smart Action Dock — colorful shortcuts · system · resources · surface (D162).
 */
export function SmartActionDock() {
  const { t } = useShellT();
  const selectedModuleId = useShellStore((s) => s.selectedModuleId);
  const dockCollapsed = useShellStore((s) => s.dockCollapsed);
  const setDockCollapsed = useShellStore((s) => s.setDockCollapsed);
  const dockMobileOpen = useShellStore((s) => s.dockMobileOpen);
  const setDockMobileOpen = useShellStore((s) => s.setDockMobileOpen);
  const { data: registry } = useMeRegistry();
  const monitor = useMonitorSnapshot();
  const surfaceMode = usePrefsStore((s) => s.surfaceMode);
  const setSurfaceMode = usePrefsStore((s) => s.setSurfaceMode);
  const panelId = useId();

  const { primary, shortcuts } = resolveDockActions(
    registry,
    selectedModuleId,
    5,
  );
  const tiles = [primary, ...shortcuts].filter(Boolean) as ActionDefinition[];
  const unique = tiles.filter(
    (a, i, arr) => arr.findIndex((x) => x.id === a.id) === i,
  );

  const snap = monitor.data;

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
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-2">
        {!dockCollapsed ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-a-fg-subtle">
            {t("smartActions")}
          </p>
        ) : (
          <span className="sr-only">{t("smartActions")}</span>
        )}
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-a-fg-muted hover:bg-a-surface-3 hover:text-a-fg"
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
          "flex flex-col gap-2",
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
            dockCollapsed && "flex flex-col items-center px-1.5",
          )}
        >
          {dockCollapsed ? (
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                snap?.db.ok && snap?.redis.ok
                  ? "bg-[var(--a-success)]"
                  : "bg-a-fg-subtle",
              )}
            />
          ) : monitor.isPending ? (
            <li className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {t("loading")}
            </li>
          ) : !snap ? (
            <li className="text-[length:var(--a-text-xs)] text-a-fg-muted">
              {t("snapshotUnavailable")}
            </li>
          ) : (
            <>
              <StatusDot
                ok
                label={t("online")}
                detail={snap.systemMode}
              />
              <StatusDot
                ok={snap.db.ok}
                label="API / DB"
                detail={snap.db.ok ? "ok" : "down"}
              />
              <StatusDot
                ok={snap.redis.ok}
                label="Redis"
                detail={snap.redis.ok ? "ok" : "down"}
              />
              <StatusDot
                ok={!snap.pressure.shedP4}
                label="Sync"
                detail={snap.pressure.shedP4 ? "shed" : "ok"}
              />
            </>
          )}
        </ul>
      </div>

      {!dockCollapsed ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-a-fg-subtle">
            {t("resources")}
          </p>
          <div className="space-y-2.5 rounded-md bg-a-surface-3/40 px-3 py-3">
            {!snap ? (
              <p className="text-[length:var(--a-text-xs)] text-a-fg-muted">
                {t("snapshotUnavailable")}
              </p>
            ) : (
              <>
                <ResourceBar label="CPU" ratio={snap.cpu.usageRatio} />
                <ResourceBar label="RAM" ratio={snap.ram.usageRatio} />
                <ResourceBar
                  label="Jobs"
                  ratio={Math.min(
                    1,
                    (snap.jobs.running + snap.jobs.pending) / 20,
                  )}
                />
              </>
            )}
          </div>
        </div>
      ) : null}

      {!dockCollapsed ? (
        <div className="mt-auto space-y-3 pt-1">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-a-fg-subtle">
              {t("surface")}
            </p>
            <div className="grid grid-cols-4 gap-1">
              {SURFACES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSurfaceMode(s.id)}
                  className={cn(
                    "rounded-md px-1 py-2 text-[9px] font-semibold transition-all",
                    surfaceMode === s.id
                      ? "bg-a-accent text-white shadow-md"
                      : "bg-a-surface-3 text-a-fg-muted hover:text-a-fg",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
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
            aria-label="Fermer"
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
  const { primary, shortcuts } = resolveDockActions(
    registry,
    selectedModuleId,
    8,
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
      <Link
        href="/settings#apparence"
        onClick={onClose}
        className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-a-fg-muted hover:bg-a-surface-3"
      >
        <Settings2 className="h-4 w-4" />
        {t("preferences")}
      </Link>
    </div>
  );
}

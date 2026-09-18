"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  globalWidgetRegistry,
  GRID,
  healthTone,
  layoutRowCount,
  THUNDER_FREE_LAYOUT_MIN_PX,
  thunderGridItemStyle,
  thunderLayoutSortKey,
  type WidgetInstance,
} from "@/lib/dashboard-engine";
import {
  ensureThunderWidgetsRegistered,
  THUNDER_COMMAND_CENTER,
  THUNDER_WIDGET_DEFINITIONS,
} from "@/lib/thunder/command-center-catalog";
import {
  deriveThunderHealth,
  overallHealth,
} from "@/lib/thunder/health-derive";
import { useThunderCcSnapshot } from "@/hooks/use-thunder-cc-snapshot";
import { useThunderDashboardStore } from "@/stores/thunder-dashboard-store";
import { useThunderCcPowerStore } from "@/stores/thunder-cc-power-store";
import {
  runThunderCcBootSequence,
  sleepThunderCc,
} from "@/lib/thunder/thunder-cc-boot";
import { AButton, APageBody, AScreenHeader } from "@/components/a";
import { ALazySlot } from "@/components/a/a-lazy-slot";
import { ASkeleton } from "@/components/a/a-skeleton";
import { cn } from "@/lib/utils";
import type { WidgetLoadState } from "@/lib/dashboard-engine";
import { ThunderCcLayoutSync } from "./thunder-cc-layout-sync";
import type { MonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import type { ThunderWidgetBodyProps } from "./thunder-widget-body";

ensureThunderWidgetsRegistered();

const LazyThunderWidgetBody = dynamic(
  () =>
    import("./thunder-widget-body").then((m) => ({
      default: m.ThunderWidgetBody,
    })),
  { ssr: false, loading: () => <ASkeleton lines={4} /> },
);

function WidgetRenderer({
  instance,
  snap,
  loadState,
  asOf,
  onRefresh,
  epsHistory,
  compact,
  freeLayout,
}: {
  instance: WidgetInstance;
  snap?: MonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string | null;
  onRefresh: () => void;
  epsHistory: number[];
  compact: boolean;
  freeLayout: boolean;
}) {
  const thresholds = useThunderDashboardStore((s) => s.thresholds);
  const editMode = useThunderDashboardStore((s) => s.editMode);
  const hideWidget = useThunderDashboardStore((s) => s.hideWidget);
  const removeWidget = useThunderDashboardStore((s) => s.removeWidget);
  const swapWidgetPositions = useThunderDashboardStore(
    (s) => s.swapWidgetPositions,
  );
  const nudgeWidget = useThunderDashboardStore((s) => s.nudgeWidget);
  const resizeWidget = useThunderDashboardStore((s) => s.resizeWidget);
  const duplicateWidget = useThunderDashboardStore((s) => s.duplicateWidget);

  const refresh = onRefresh;

  const def = globalWidgetRegistry.find(instance.widgetDefinitionId);
  const title = def?.name ?? instance.widgetDefinitionId;

  const bodyProps: ThunderWidgetBodyProps = {
    widgetDefinitionId: instance.widgetDefinitionId,
    title,
    snap,
    loadState,
    asOf,
    onRefresh: refresh,
    epsHistory,
    thresholds,
  };

  const body: ReactNode = (
    <ALazySlot name={title} strategy="viewport" skeletonLines={4}>
      <LazyThunderWidgetBody {...bodyProps} />
    </ALazySlot>
  );

  return (
    <div
      className={cn(
        "thunder-cc-tile relative z-[1] flex h-full min-h-[11rem] flex-col",
        editMode && freeLayout && "ring-1 ring-a-accent/30",
        editMode && freeLayout && "cursor-grab active:cursor-grabbing",
      )}
      style={thunderGridItemStyle(instance.position, compact) as CSSProperties}
      draggable={editMode && freeLayout}
      onDragStart={(e) => {
        if (!editMode || !freeLayout) return;
        e.dataTransfer.setData("text/thunder-widget-id", instance.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!editMode || !freeLayout) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (!editMode || !freeLayout) return;
        e.preventDefault();
        e.stopPropagation();
        const fromId = e.dataTransfer.getData("text/thunder-widget-id");
        if (fromId) swapWidgetPositions(fromId, instance.id);
      }}
    >
      {editMode && freeLayout ? (
        <div className="mb-1 flex flex-wrap gap-1">
          <span className="rounded bg-a-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-a-accent">
            x{instance.position.x} y{instance.position.y}
          </span>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => nudgeWidget(instance.id, -1, 0)}
            title="Nudge left"
          >
            ←
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => nudgeWidget(instance.id, 1, 0)}
            title="Nudge right"
          >
            →
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => nudgeWidget(instance.id, 0, -1)}
            title="Nudge up"
          >
            ↑
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => nudgeWidget(instance.id, 0, 1)}
            title="Nudge down"
          >
            ↓
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              resizeWidget(instance.id, { w: instance.position.w + 1 })
            }
          >
            +w
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              resizeWidget(instance.id, { w: instance.position.w - 1 })
            }
          >
            −w
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              resizeWidget(instance.id, { h: instance.position.h + 1 })
            }
          >
            +h
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              resizeWidget(instance.id, { h: instance.position.h - 1 })
            }
          >
            −h
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => duplicateWidget(instance.id)}
          >
            Dup
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => hideWidget(instance.id)}
          >
            Hide
          </button>
          <button
            type="button"
            className="rounded bg-a-danger-soft px-1.5 py-0.5 text-[10px] text-a-danger-fg"
            onClick={() => removeWidget(instance.id)}
          >
            Remove
          </button>
        </div>
      ) : editMode ? (
        <div className="mb-1 flex flex-wrap gap-1">
          <span className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted">
            Confort · élargir le panneau pour free x/y
          </span>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => duplicateWidget(instance.id)}
          >
            Dup
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() => hideWidget(instance.id)}
          >
            Hide
          </button>
          <button
            type="button"
            className="rounded bg-a-danger-soft px-1.5 py-0.5 text-[10px] text-a-danger-fg"
            onClick={() => removeWidget(instance.id)}
          >
            Remove
          </button>
        </div>
      ) : null}
      {body}
    </div>
  );
}

export function ThunderCommandCenter() {
  const liveMode = useThunderDashboardStore((s) => s.liveMode);
  const power = useThunderCcPowerStore((s) => s.power);
  const monitor = useThunderCcSnapshot({
    live: power === "on" && liveMode,
  });
  const widgets = useThunderDashboardStore((s) => s.widgets);
  const editMode = useThunderDashboardStore((s) => s.editMode);
  const setEditMode = useThunderDashboardStore((s) => s.setEditMode);
  const setLiveMode = useThunderDashboardStore((s) => s.setLiveMode);
  const resetLayout = useThunderDashboardStore((s) => s.resetLayout);
  const compact = useThunderDashboardStore((s) => s.compact);
  const setCompact = useThunderDashboardStore((s) => s.setCompact);
  const addWidget = useThunderDashboardStore((s) => s.addWidget);
  const showWidget = useThunderDashboardStore((s) => s.showWidget);
  const placeWidgetAt = useThunderDashboardStore((s) => s.placeWidgetAt);
  const densifyLayout = useThunderDashboardStore((s) => s.densifyLayout);
  const [addOpen, setAddOpen] = useState(false);
  const [dropHover, setDropHover] = useState<string | null>(null);
  const [freeLayout, setFreeLayout] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ensureThunderWidgetsRegistered();
  }, []);

  useEffect(() => {
    void runThunderCcBootSequence();
    return () => {
      sleepThunderCc();
    };
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const apply = (w: number) => {
      setFreeLayout(w >= THUNDER_FREE_LAYOUT_MIN_PX);
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      apply(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hidden = useMemo(
    () => widgets.filter((w) => !w.visibility),
    [widgets],
  );

  const addableDefs = useMemo(() => THUNDER_WIDGET_DEFINITIONS, []);

  /** Show all registered widgets; each tile handles forbidden/unavailable. */
  const visible = useMemo(() => {
    return [...widgets]
      .filter((w) => w.visibility)
      .sort((a, b) => thunderLayoutSortKey(a) - thunderLayoutSortKey(b));
  }, [widgets]);

  const healthItems = deriveThunderHealth(monitor.data);
  const overall = overallHealth(healthItems);
  const tone = healthTone(overall);
  const snap = monitor.data;
  const loadState = monitor.loadState;
  const asOf = snap?.asOf ?? null;
  const onRefresh = () => void monitor.refresh();
  const epsHistory = monitor.epsHistory;
  const rowCount = useMemo(
    () => layoutRowCount(visible, editMode ? 3 : 1),
    [visible, editMode],
  );
  const dropCells = useMemo(() => {
    if (!editMode || !freeLayout) {
      return [] as Array<{ x: number; y: number; key: string }>;
    }
    const cells: Array<{ x: number; y: number; key: string }> = [];
    for (let y = 0; y < rowCount; y += 1) {
      for (let x = 0; x < GRID.desktop; x += 1) {
        cells.push({ x, y, key: `c-${x}-${y}` });
      }
    }
    return cells;
  }, [editMode, freeLayout, rowCount]);

  if (power !== "on") {
    return (
      <APageBody>
        <p className="sr-only">Démarrage Thunder Core Command Center…</p>
      </APageBody>
    );
  }

  return (
    <APageBody>
      <AScreenHeader
        title={THUNDER_COMMAND_CENTER.name}
        description={THUNDER_COMMAND_CENTER.description}
        status={
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full bg-a-surface-3 px-2.5 py-1 text-[11px] font-medium",
              tone.className,
            )}
          >
            <span className={cn("size-1.5 rounded-full", tone.dotClass)} />
            {tone.label}
            {!liveMode ? " · DEGRADED VIEW" : null}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AButton
              type="button"
              size="sm"
              variant={liveMode ? "primary" : "secondary"}
              onClick={() => setLiveMode(!liveMode)}
            >
              Live
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant={editMode ? "primary" : "secondary"}
              onClick={() => setEditMode(!editMode)}
            >
              Layout
            </AButton>
            {editMode ? (
              <>
                <AButton
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setAddOpen((v) => !v)}
                >
                  + Widget
                </AButton>
                {freeLayout ? (
                  <AButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => densifyLayout()}
                    title="Pack sans trous (gauche → droite, haut → bas)"
                  >
                    Densifier
                  </AButton>
                ) : (
                  <span className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
                    {`Confort · pane < ${THUNDER_FREE_LAYOUT_MIN_PX}px`}
                  </span>
                )}
              </>
            ) : null}
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setCompact(!compact)}
            >
              {compact ? "Comfort" : "Compact"}
            </AButton>
            <AButton
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => resetLayout()}
            >
              Reset
            </AButton>
            <ThunderCcLayoutSync className="flex flex-wrap items-center gap-1.5" />
            <Link
              href="/settings#poste"
              className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
            >
              Prefs
            </Link>
            <Link
              href="/repair"
              className="text-[length:var(--a-text-xs)] font-medium text-a-accent hover:underline"
            >
              Repair
            </Link>
          </div>
        }
      />

      {editMode && addOpen ? (
        <div className="a-card mt-3 p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-a-fg-subtle">
            Ajouter un widget
          </p>
          <ul className="a-ios-scroll grid max-h-48 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {addableDefs.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="flex w-full flex-col rounded-[var(--a-radius-sm)] px-2.5 py-2 text-left hover:bg-a-surface-3"
                  onClick={() => {
                    addWidget(d.id);
                    setAddOpen(false);
                  }}
                >
                  <span className="text-[length:var(--a-text-sm)] font-medium text-a-fg">
                    {d.name}
                  </span>
                  <span className="text-[10px] text-a-fg-subtle">
                    {d.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {hidden.length > 0 ? (
            <div className="mt-3 border-t border-[color:var(--a-border-subtle)] pt-2">
              <p className="mb-1 text-[11px] font-medium text-a-fg-muted">
                Masqués
              </p>
              <ul className="flex flex-wrap gap-1">
                {hidden.map((w) => {
                  const def = globalWidgetRegistry.find(w.widgetDefinitionId);
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        className="rounded-full bg-a-surface-3 px-2 py-0.5 text-[10px] text-a-fg hover:bg-a-accent-muted"
                        onClick={() => showWidget(w.id)}
                      >
                        {def?.name ?? w.widgetDefinitionId}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div ref={gridRef} className="thunder-cc-shell mt-4">
        <div
          className={cn(
            "thunder-cc-grid",
            compact && "is-compact",
            freeLayout && "is-free",
          )}
        >
        {dropCells.map((cell) => (
          <div
            key={cell.key}
            aria-hidden
            className={cn(
              "thunder-cc-drop-cell pointer-events-none relative z-0 hidden rounded-[var(--a-radius-sm)] border border-dashed border-[color:var(--a-border-subtle)]/70 bg-a-surface-3/20",
              dropHover === cell.key &&
                "border-a-accent bg-a-accent-muted/50",
            )}
            style={
              {
                gridColumn: `${cell.x + 1} / span 1`,
                gridRow: `${cell.y + 1} / span 1`,
              } as CSSProperties
            }
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropHover(cell.key);
            }}
            onDragLeave={() =>
              setDropHover((cur) => (cur === cell.key ? null : cur))
            }
            onDrop={(e) => {
              e.preventDefault();
              setDropHover(null);
              const fromId = e.dataTransfer.getData("text/thunder-widget-id");
              if (fromId) placeWidgetAt(fromId, cell.x, cell.y);
            }}
          />
        ))}
        {visible.map((w) => (
          <WidgetRenderer
            key={w.id}
            instance={w}
            snap={snap}
            loadState={loadState}
            asOf={asOf}
            onRefresh={onRefresh}
            epsHistory={epsHistory}
            compact={compact}
            freeLayout={freeLayout}
          />
        ))}
        </div>
      </div>
    </APageBody>
  );
}

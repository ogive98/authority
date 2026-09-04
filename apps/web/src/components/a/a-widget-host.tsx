"use client";

/**
 * Isolated dashboard host: error boundary per card + viewport/dynamic import.
 * Reorder with ↑↓ (dnd-kit deferred). Persist ids in localStorage.
 */
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useInView } from "@/hooks/use-in-view";
import {
  LAYOUT_STORAGE_KEY,
  SHELL_WIDGETS,
  sortWidgets,
  type WidgetDef,
} from "@/lib/widget-catalog";
import { ASkeleton } from "./a-skeleton";
import { AWidgetBoundary } from "./a-widget-boundary";
import {
  ModulesWidgetBody,
  MonitorWidgetBody,
} from "./widgets/shell-widgets";

const ViewportJobs = dynamic(
  () =>
    import("./widgets/shell-widgets").then((m) => ({
      default: m.JobsWidgetBody,
    })),
  { ssr: false, loading: () => <ASkeleton lines={3} /> },
);

const ViewportAudit = dynamic(
  () =>
    import("./widgets/shell-widgets").then((m) => ({
      default: m.AuditWidgetBody,
    })),
  { ssr: false, loading: () => <ASkeleton lines={3} /> },
);

const ViewportBoom = dynamic(
  () =>
    import("./widgets/shell-widgets").then((m) => ({
      default: m.BoomWidgetBody,
    })),
  { ssr: false, loading: () => <ASkeleton lines={2} /> },
);

export type AWidgetHostProps = {
  includeBoom?: boolean;
  persist?: boolean;
  className?: string;
};

export function AWidgetHost({
  includeBoom = false,
  persist = true,
  className,
}: AWidgetHostProps) {
  const catalog = useMemo(
    () =>
      includeBoom
        ? SHELL_WIDGETS
        : SHELL_WIDGETS.filter((w) => !w.boom),
    [includeBoom],
  );
  const [order, setOrder] = useState<string[]>(() => catalog.map((w) => w.id));

  useEffect(() => {
    if (!persist) return;
    try {
      const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        const allowed = new Set(catalog.map((w) => w.id));
        setOrder(parsed.filter((id) => allowed.has(id)));
      }
    } catch {
      /* ignore corrupt layout JSON */
    }
  }, [persist, catalog]);

  const widgets = sortWidgets(catalog, order);

  function move(id: string, dir: -1 | 1) {
    const ids = widgets.map((w) => w.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = ids.slice();
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
    setOrder(next);
    if (persist) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(next));
    }
  }

  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {widgets.map((w, index) => (
        <WidgetSlot
          key={w.id}
          def={w}
          canUp={index > 0}
          canDown={index < widgets.length - 1}
          onUp={() => move(w.id, -1)}
          onDown={() => move(w.id, 1)}
        />
      ))}
    </div>
  );
}

function WidgetSlot({
  def,
  canUp,
  canDown,
  onUp,
  onDown,
}: {
  def: WidgetDef;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  const lazy = def.loadStrategy === "viewport";
  const { ref, inView } = useInView<HTMLElement>(lazy);

  return (
    <article
      ref={ref}
      className="a-card flex min-h-48 flex-col p-[var(--a-space-4)]"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[length:var(--a-text-md)] font-medium">
            {def.title}
          </h2>
          <p className="text-[length:var(--a-text-xs)] text-a-fg-subtle">
            {def.loadStrategy}
            {" · "}
            {def.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="h-7 w-7 rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-a-surface-3 disabled:opacity-30"
            aria-label="Monter"
            disabled={!canUp}
            onClick={onUp}
          >
            ↑
          </button>
          <button
            type="button"
            className="h-7 w-7 rounded-[var(--a-radius-sm)] text-a-fg-muted hover:bg-a-surface-3 disabled:opacity-30"
            aria-label="Descendre"
            disabled={!canDown}
            onClick={onDown}
          >
            ↓
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {lazy && !inView ? (
          <ASkeleton lines={4} />
        ) : (
          <AWidgetBoundary name={def.title}>
            <WidgetBody def={def} />
          </AWidgetBoundary>
        )}
      </div>
    </article>
  );
}

function WidgetBody({ def }: { def: WidgetDef }) {
  if (def.boom) return <ViewportBoom />;
  switch (def.id) {
    case "monitor":
      return <MonitorWidgetBody />;
    case "modules":
      return <ModulesWidgetBody />;
    case "jobs":
      return <ViewportJobs />;
    case "audit":
      return <ViewportAudit />;
    default:
      return null;
  }
}

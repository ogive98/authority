"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  colSpanClass,
  globalWidgetRegistry,
  healthTone,
  type WidgetInstance,
} from "@/lib/dashboard-engine";
import {
  ensureThunderWidgetsRegistered,
  THUNDER_COMMAND_CENTER,
} from "@/lib/thunder/command-center-catalog";
import {
  deriveThunderHealth,
  overallHealth,
} from "@/lib/thunder/health-derive";
import { useMonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import { useThunderDashboardStore } from "@/stores/thunder-dashboard-store";
import { useMeGrants } from "@/hooks/use-me-grants";
import { AButton, APageBody, AScreenHeader } from "@/components/a";
import { cn } from "@/lib/utils";
import {
  ActivityFeedWidget,
  AlertsWidget,
  ApiPerfWidget,
  AutomationFlowWidget,
  CoreRuntimeWidget,
  EventBusWidget,
  IncidentsWidget,
  IntegrationsWidget,
  monitorState,
  OutboxWidget,
  PostgresWidget,
  QueuesWidget,
  RedisWidget,
  ResourcesWidget,
  SchedulerPlaceholderWidget,
  ThroughputWidget,
  ThunderHealthWidget,
  WorkersWidget,
} from "./thunder-widgets";

ensureThunderWidgetsRegistered();

function WidgetRenderer({
  instance,
}: {
  instance: WidgetInstance;
}) {
  const monitor = useMonitorSnapshot();
  const liveMode = useThunderDashboardStore((s) => s.liveMode);
  const thresholds = useThunderDashboardStore((s) => s.thresholds);
  const editMode = useThunderDashboardStore((s) => s.editMode);
  const hideWidget = useThunderDashboardStore((s) => s.hideWidget);
  const updateWidget = useThunderDashboardStore((s) => s.updateWidget);
  const removeWidget = useThunderDashboardStore((s) => s.removeWidget);

  const snap = monitor.data;
  const loadState = monitorState(monitor, liveMode);
  const asOf = snap?.asOf ?? null;
  const refresh = () => void monitor.refetch();

  const def = globalWidgetRegistry.find(instance.widgetDefinitionId);
  const title = def?.name ?? instance.widgetDefinitionId;

  let body: ReactNode = null;
  switch (instance.widgetDefinitionId) {
    case "thunder.health":
      body = (
        <ThunderHealthWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
          thresholds={thresholds}
        />
      );
      break;
    case "thunder.runtime":
      body = (
        <CoreRuntimeWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.incidents":
      body = (
        <IncidentsWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.event-bus":
      body = (
        <EventBusWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.workers":
      body = (
        <WorkersWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.queues":
      body = (
        <QueuesWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.automation-flow":
      body = (
        <AutomationFlowWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.throughput":
      body = (
        <ThroughputWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.api":
      body = (
        <ApiPerfWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.postgres":
      body = (
        <PostgresWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.redis":
      body = (
        <RedisWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.outbox":
      body = (
        <OutboxWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.scheduler":
      body = (
        <SchedulerPlaceholderWidget
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.resources":
      body = (
        <ResourcesWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.alerts":
      body = (
        <AlertsWidget
          snap={snap}
          thresholds={thresholds}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.activity":
      body = (
        <ActivityFeedWidget
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    case "thunder.integrations":
      body = (
        <IntegrationsWidget
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
      break;
    default:
      body = (
        <div className="a-card p-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
          Widget inconnu: {title}
        </div>
      );
  }

  return (
    <div
      className={cn(
        colSpanClass(instance.position.w),
        "min-h-0",
        editMode && "ring-1 ring-a-accent/30",
      )}
    >
      {editMode ? (
        <div className="mb-1 flex flex-wrap gap-1">
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              updateWidget(instance.id, {
                position: {
                  ...instance.position,
                  w: Math.min(12, instance.position.w + 1),
                },
              })
            }
          >
            +w
          </button>
          <button
            type="button"
            className="rounded bg-a-surface-3 px-1.5 py-0.5 text-[10px] text-a-fg-muted"
            onClick={() =>
              updateWidget(instance.id, {
                position: {
                  ...instance.position,
                  w: Math.max(3, instance.position.w - 1),
                },
              })
            }
          >
            −w
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
  const { grants } = useMeGrants();
  const monitor = useMonitorSnapshot();
  const widgets = useThunderDashboardStore((s) => s.widgets);
  const editMode = useThunderDashboardStore((s) => s.editMode);
  const setEditMode = useThunderDashboardStore((s) => s.setEditMode);
  const liveMode = useThunderDashboardStore((s) => s.liveMode);
  const setLiveMode = useThunderDashboardStore((s) => s.setLiveMode);
  const resetLayout = useThunderDashboardStore((s) => s.resetLayout);
  const compact = useThunderDashboardStore((s) => s.compact);
  const setCompact = useThunderDashboardStore((s) => s.setCompact);

  useEffect(() => {
    ensureThunderWidgetsRegistered();
  }, []);

  const canView =
    grants == null || grants.has("system_monitoring.view");

  const visible = useMemo(() => {
    return [...widgets]
      .filter((w) => w.visibility)
      .filter((w) => {
        const def = globalWidgetRegistry.find(w.widgetDefinitionId);
        if (!def) return false;
        if (grants == null) return true;
        return def.permissions.every((p) => grants.has(p));
      })
      .sort((a, b) => a.order - b.order);
  }, [widgets, grants]);

  const healthItems = deriveThunderHealth(monitor.data);
  const overall = overallHealth(healthItems);
  const tone = healthTone(overall);

  if (!canView) {
    return (
      <APageBody>
        <AScreenHeader
          title="Thunder Core"
          description="Permission system_monitoring.view requise."
        />
        <p className="mt-4 text-[length:var(--a-text-sm)] text-a-fg-muted">
          Accès refusé — contactez un administrateur.
        </p>
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

      <div
        className={cn(
          "mt-4 grid grid-cols-4 gap-3 md:grid-cols-8 lg:grid-cols-12",
          compact && "gap-2",
        )}
      >
        {visible.map((w) => (
          <WidgetRenderer key={w.id} instance={w} />
        ))}
      </div>
    </APageBody>
  );
}

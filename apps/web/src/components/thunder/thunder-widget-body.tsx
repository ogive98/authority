"use client";

/**
 * Thunder widget body switch (D296) — separate module for next/dynamic.
 * Keeps thunder-command-center chrome free of the thunder-widgets chunk.
 */
import type { ReactNode } from "react";
import type { WidgetLoadState } from "@/lib/dashboard-engine";
import type { ThunderAlertThresholds } from "@/lib/thunder/alert-thresholds";
import type { MonitorSnapshot } from "@/hooks/use-monitor-snapshot";
import {
  ActivityFeedWidget,
  AlertsWidget,
  ApiPerfWidget,
  AutomationFlowWidget,
  CoreRuntimeWidget,
  EventBusWidget,
  IncidentsWidget,
  IntegrationsWidget,
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

export type ThunderWidgetBodyProps = {
  widgetDefinitionId: string;
  title: string;
  snap?: MonitorSnapshot;
  loadState: WidgetLoadState;
  asOf?: string | null;
  onRefresh: () => void;
  epsHistory: number[];
  thresholds: ThunderAlertThresholds;
};

export function ThunderWidgetBody({
  widgetDefinitionId,
  title,
  snap,
  loadState,
  asOf,
  onRefresh,
  epsHistory,
  thresholds,
}: ThunderWidgetBodyProps): ReactNode {
  const refresh = onRefresh;

  switch (widgetDefinitionId) {
    case "thunder.health":
      return (
        <ThunderHealthWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
          thresholds={thresholds}
        />
      );
    case "thunder.runtime":
      return (
        <CoreRuntimeWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.incidents":
      return (
        <IncidentsWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.event-bus":
      return (
        <EventBusWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.workers":
      return (
        <WorkersWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.queues":
      return (
        <QueuesWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.automation-flow":
      return (
        <AutomationFlowWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.throughput":
      return (
        <ThroughputWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
          epsHistory={epsHistory}
        />
      );
    case "thunder.api":
      return (
        <ApiPerfWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.postgres":
      return (
        <PostgresWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.redis":
      return (
        <RedisWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.outbox":
      return (
        <OutboxWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.scheduler":
      return (
        <SchedulerPlaceholderWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.resources":
      return (
        <ResourcesWidget
          snap={snap}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.alerts":
      return (
        <AlertsWidget
          snap={snap}
          thresholds={thresholds}
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.activity":
      return (
        <ActivityFeedWidget
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    case "thunder.integrations":
      return (
        <IntegrationsWidget
          loadState={loadState}
          asOf={asOf ?? undefined}
          onRefresh={refresh}
        />
      );
    default:
      return (
        <div className="a-card p-3 text-[length:var(--a-text-sm)] text-a-fg-muted">
          Widget inconnu: {title}
        </div>
      );
  }
}

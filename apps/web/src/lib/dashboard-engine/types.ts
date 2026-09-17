/**
 * Dashboard Engine — generic contracts (Thunder + future module dashboards).
 * D294: opaque surfaces · one accent · registry-driven · no fake KPI.
 */

export type DashboardScope =
  | "SYSTEM"
  | "TENANT"
  | "COMPANY"
  | "SITE"
  | "USER"
  | "ROLE";

export type WidgetType =
  | "metric-card"
  | "status-card"
  | "gauge"
  | "sparkline"
  | "progress"
  | "table"
  | "event-feed"
  | "service-status"
  | "worker-list"
  | "queue-list"
  | "integration-matrix"
  | "alert-list"
  | "incident-list"
  | "flow"
  | "kpi"
  | "custom";

export type WidgetCategory =
  | "health"
  | "runtime"
  | "jobs"
  | "events"
  | "integrations"
  | "alerts"
  | "performance"
  | "system";

export type HealthState =
  | "HEALTHY"
  | "DEGRADED"
  | "WARNING"
  | "CRITICAL"
  | "OFFLINE"
  | "UNKNOWN";

export type WidgetLoadState =
  | "loading"
  | "loaded"
  | "empty"
  | "error"
  | "unavailable"
  | "forbidden"
  | "stale";

export type WidgetSizeUnit = {
  w: number;
  h: number;
};

export type WidgetGridPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ConfigFieldType =
  | "number"
  | "string"
  | "boolean"
  | "select"
  | "multiselect";

export type WidgetConfigField = {
  key: string;
  type: ConfigFieldType;
  label: string;
  description?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  default?: unknown;
};

export type WidgetConfigSchema = {
  fields: WidgetConfigField[];
};

export type WidgetDefinition = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: WidgetCategory;
  type: WidgetType;
  module: string;
  version: string;
  dataProvider: string;
  defaultSize: WidgetSizeUnit;
  minSize: WidgetSizeUnit;
  maxSize: WidgetSizeUnit;
  refreshPolicy: "shared-monitor" | "own" | "manual";
  permissions: string[];
  configurationSchema: WidgetConfigSchema;
  actions?: string[];
  enabled: boolean;
};

export type WidgetInstance = {
  id: string;
  widgetDefinitionId: string;
  dashboardId: string;
  position: WidgetGridPosition;
  configuration: Record<string, unknown>;
  visibility: boolean;
  order: number;
};

export type DashboardDefinition = {
  id: string;
  code: string;
  name: string;
  description: string;
  module: string;
  scope: DashboardScope;
  layout: {
    columnsDesktop: 12;
    columnsTablet: 8;
    columnsMobile: 4;
  };
  widgets: WidgetInstance[];
  permissions: string[];
  defaultDashboard: boolean;
  active: boolean;
};

export type HealthItem = {
  id: string;
  label: string;
  state: HealthState;
  detail?: string;
};

/** Map health → D294 semantic token classes (never color-only). */
export function healthTone(state: HealthState): {
  label: string;
  className: string;
  dotClass: string;
} {
  switch (state) {
    case "HEALTHY":
      return {
        label: "Healthy",
        className: "text-a-success-fg",
        dotClass: "bg-a-success",
      };
    case "DEGRADED":
    case "WARNING":
      return {
        label: state === "DEGRADED" ? "Degraded" : "Warning",
        className: "text-a-warning-fg",
        dotClass: "bg-a-warning",
      };
    case "CRITICAL":
    case "OFFLINE":
      return {
        label: state === "OFFLINE" ? "Offline" : "Critical",
        className: "text-a-danger-fg",
        dotClass: "bg-a-danger",
      };
    default:
      return {
        label: "Unknown",
        className: "text-a-fg-subtle",
        dotClass: "bg-a-surface-4",
      };
  }
}

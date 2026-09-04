/**
 * Dashboard widget catalog. Boom widget is a UI-10 isolation gate only.
 */
export type WidgetLoadStrategy = "immediate" | "viewport";

export type WidgetDef = {
  id: string;
  title: string;
  description: string;
  loadStrategy: WidgetLoadStrategy;
  /** Gate: this widget throws — host must isolate. */
  boom?: boolean;
};

export const SHELL_WIDGETS: WidgetDef[] = [
  {
    id: "monitor",
    title: "Resource monitor",
    description: "CPU, RAM, files, shed P4 — snapshot Thunder",
    loadStrategy: "immediate",
  },
  {
    id: "modules",
    title: "Modules",
    description: "Modules ENABLED (registry)",
    loadStrategy: "immediate",
  },
  {
    id: "jobs",
    title: "Jobs",
    description: "Pending / running / DLQ",
    loadStrategy: "viewport",
  },
  {
    id: "audit",
    title: "Activité récente",
    description: "Derniers événements (stub jusqu’au module audit)",
    loadStrategy: "viewport",
  },
  {
    id: "boom",
    title: "Widget cassé (gate)",
    description: "Doit échouer sans crasher le dashboard",
    loadStrategy: "viewport",
    boom: true,
  },
];

export function sortWidgets(
  catalog: WidgetDef[],
  order: string[],
): WidgetDef[] {
  const map = new Map(catalog.map((w) => [w.id, w]));
  const out: WidgetDef[] = [];
  for (const id of order) {
    const w = map.get(id);
    if (w) out.push(w);
  }
  for (const w of catalog) {
    if (!out.some((x) => x.id === w.id)) out.push(w);
  }
  return out;
}

export const LAYOUT_STORAGE_KEY = "authority-dashboard-layout";

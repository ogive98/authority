/**
 * Widget Registry (D294) — home Mission Control + /dev/dashboard shells.
 * KPIs = live /home-kpis only (D165); never invent CA/€.
 */

export type WidgetLoadStrategy = "immediate" | "viewport";

export type WidgetContext = "home" | "dev" | `module:${string}`;

export type WidgetSize = "sm" | "md" | "lg" | "hero";

export type WidgetDef = {
  id: string;
  title: string;
  description: string;
  loadStrategy: WidgetLoadStrategy;
  contexts: WidgetContext[];
  size: WidgetSize;
  /** Gate: this widget throws — host must isolate. */
  boom?: boolean;
};

/** Legacy /dev dashboard widgets. */
export const SHELL_WIDGETS: WidgetDef[] = [
  {
    id: "monitor",
    title: "Resource monitor",
    description: "CPU, RAM, files, shed P4 — snapshot Thunder",
    loadStrategy: "immediate",
    contexts: ["dev", "home"],
    size: "md",
  },
  {
    id: "modules",
    title: "Modules",
    description: "Modules ENABLED (registry)",
    loadStrategy: "immediate",
    contexts: ["dev", "home"],
    size: "md",
  },
  {
    id: "jobs",
    title: "Jobs",
    description: "Pending / running / DLQ",
    loadStrategy: "viewport",
    contexts: ["dev"],
    size: "sm",
  },
  {
    id: "audit",
    title: "Activité récente",
    description: "Derniers événements (stub jusqu’au module audit)",
    loadStrategy: "viewport",
    contexts: ["dev", "home"],
    size: "md",
  },
  {
    id: "boom",
    title: "Widget cassé (gate)",
    description: "Doit échouer sans crasher le dashboard",
    loadStrategy: "viewport",
    contexts: ["dev"],
    size: "sm",
    boom: true,
  },
];

/** Home Mission Control widgets — live KPIs from module /home-kpis (D165). */
export const HOME_WIDGETS: WidgetDef[] = [
  {
    id: "hero-context",
    title: "Contexte",
    description: "Salutation + rôle depuis /me",
    loadStrategy: "immediate",
    contexts: ["home"],
    size: "hero",
  },
  {
    id: "kpi-strip",
    title: "Indicateurs",
    description:
      "AR TND + commandes + stock + échues — agrégats DB, pas de CA inventé",
    loadStrategy: "immediate",
    contexts: ["home"],
    size: "lg",
  },
  {
    id: "shell-status",
    title: "État plateforme",
    description: "Snapshot monitor Thunder",
    loadStrategy: "viewport",
    contexts: ["home"],
    size: "md",
  },
  {
    id: "module-shortcuts",
    title: "Raccourcis module",
    description: "Features du module sélectionné (registry)",
    loadStrategy: "viewport",
    contexts: ["home"],
    size: "lg",
  },
  {
    id: "tasks",
    title: "Tâches",
    description: "File vide utile — pas de fake backlog",
    loadStrategy: "viewport",
    contexts: ["home"],
    size: "sm",
  },
  {
    id: "activity",
    title: "Activité",
    description: "Notifications locales / SSE",
    loadStrategy: "viewport",
    contexts: ["home"],
    size: "md",
  },
  {
    id: "ai-panel",
    title: "Assistant IA",
    description: "Surface DISABLED tant que l’IA n’est pas activée",
    loadStrategy: "viewport",
    contexts: ["home"],
    size: "sm",
  },
  {
    id: "treasury",
    title: "Trésorerie bancaire",
    description:
      "Comptes / rapprochement + solde GL si accounting.gl.bank Prefs (D197)",
    loadStrategy: "viewport",
    contexts: ["home", "module:finance"],
    size: "md",
  },
  {
    id: "backup-status",
    title: "Sauvegarde",
    description:
      "Compteurs backup réels + restores ouverts + planning Tunis (D310)",
    loadStrategy: "viewport",
    contexts: ["home", "module:backup"],
    size: "md",
  },
];

export function widgetsForContext(
  catalog: WidgetDef[],
  context: WidgetContext,
): WidgetDef[] {
  return catalog.filter((w) => w.contexts.includes(context));
}

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
export const HOME_LAYOUT_STORAGE_KEY = "authority-home-layout";

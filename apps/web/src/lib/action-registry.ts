/**
 * Action Registry (D161/D294) — single source for ⌘K, Smart Action Dock, shortcuts.
 * Catalog entries live in command-catalog; this module adds contexts + filtering
 * by active me-registry modules (never hardcode sidebar/dashboard actions).
 * Labels localized via locale overlay (D166).
 * Entitlements: omit grants → registry-trusted (no DEMO overclaim).
 */

import {
  COMMAND_CATALOG,
  filterCommands,
  type CommandGroupId,
  type CommandItem,
  type CommandShortcut,
} from "./command-catalog";
import type { MeRegistry } from "./registry";
import type { ShellLocale } from "@/stores/locale-store";
import { localizeCommandItems } from "@/lib/i18n/command-labels";

export type ActionContext =
  | "global"
  | "palette"
  | "dock"
  | "home"
  | `module:${string}`;

export type ActionDangerLevel = "none" | "caution" | "destructive";

export type ActionDefinition = CommandItem & {
  moduleId?: string;
  contexts: ActionContext[];
  dangerLevel: ActionDangerLevel;
  /** Primary CTA weight in Smart Action Dock (lower = higher). */
  dockPriority?: number;
};

function toAction(item: CommandItem): ActionDefinition {
  const moduleId = item.requiresModule;
  const contexts: ActionContext[] = ["global", "palette"];
  if (item.group === "navigation" || item.group === "actions") {
    contexts.push("dock", "home");
  }
  if (moduleId) {
    contexts.push(`module:${moduleId}`);
  }
  return {
    ...item,
    moduleId,
    contexts,
    dangerLevel: item.id.includes("payroll") ? "caution" : "none",
    dockPriority:
      item.group === "navigation"
        ? 10
        : item.group === "actions"
          ? 20
          : 50,
  };
}

/** Full action registry derived from the command catalog (FR source labels). */
export const ACTION_REGISTRY: ActionDefinition[] = COMMAND_CATALOG.map(toAction);

export function getActionRegistry(
  locale: ShellLocale = "fr",
): ActionDefinition[] {
  return localizeCommandItems(ACTION_REGISTRY, locale).map((item) => {
    const base = ACTION_REGISTRY.find((a) => a.id === item.id);
    return base ? { ...base, label: item.label } : toAction(item);
  });
}

export function enabledModulesFromRegistry(
  registry: MeRegistry,
): Set<string> {
  return new Set(registry.modules.map((m) => m.key));
}

export type ResolveActionsOpts = {
  query?: string;
  /**
   * Explicit ACL snapshot. Omit for registry-trusted filtering (D294 Track F).
   * Pass a Set (e.g. DEMO_PERMISSION_GRANTS) only in demos/selftests.
   */
  grants?: Set<string> | null;
  registry: MeRegistry;
  context?: ActionContext | ActionContext[];
  /** Cap results (dock shortcuts). */
  limit?: number;
  locale?: ShellLocale;
};

/**
 * Filter actions by active modules + optional grants + context + query.
 */
export function resolveActions(opts: ResolveActionsOpts): ActionDefinition[] {
  const enabledModules = enabledModulesFromRegistry(opts.registry);
  // Accueil always addressable for Mission Control chrome.
  enabledModules.add("home");

  const catalog = getActionRegistry(opts.locale ?? "fr");
  const filtered = filterCommands(catalog, {
    query: opts.query ?? "",
    grants: opts.grants,
    enabledModules,
  }) as ActionDefinition[];

  const contexts = opts.context
    ? Array.isArray(opts.context)
      ? opts.context
      : [opts.context]
    : null;

  let out = filtered;
  if (contexts) {
    out = out.filter((a) =>
      contexts.some(
        (c) => a.contexts.includes(c) || a.contexts.includes("global"),
      ),
    );
  }

  out = [...out].sort(
    (a, b) => (a.dockPriority ?? 99) - (b.dockPriority ?? 99),
  );

  if (opts.limit != null) {
    out = out.slice(0, opts.limit);
  }
  return out;
}

/** Dock: primary + shortcuts from registry for selected module. */
export function resolveDockActions(
  registry: MeRegistry,
  selectedModuleId: string,
  limit = 8,
  locale: ShellLocale = "fr",
): { primary: ActionDefinition | null; shortcuts: ActionDefinition[] } {
  const moduleCtx = `module:${selectedModuleId}` as ActionContext;
  const forModule = resolveActions({
    registry,
    context: [moduleCtx, "dock", "home"],
    limit: limit + 2,
    locale,
  });
  const nav = forModule.filter((a) => a.group === "navigation");
  const primary =
    nav.find((a) => a.moduleId === selectedModuleId) ?? nav[0] ?? null;
  const shortcuts = forModule
    .filter((a) => a.id !== primary?.id)
    .slice(0, limit);
  return { primary, shortcuts };
}

export type {
  CommandGroupId,
  CommandItem,
  CommandShortcut,
};

/**
 * Action Registry (D161) — single source for ⌘K, Smart Action Dock, shortcuts.
 * Catalog entries live in command-catalog; this module adds contexts + filtering
 * by active me-registry modules (never hardcode sidebar/dashboard actions).
 */

import {
  COMMAND_CATALOG,
  DEMO_PERMISSION_GRANTS,
  filterCommands,
  type CommandGroupId,
  type CommandItem,
  type CommandShortcut,
} from "./command-catalog";
import type { MeRegistry } from "./registry";

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

/** Full action registry derived from the command catalog. */
export const ACTION_REGISTRY: ActionDefinition[] = COMMAND_CATALOG.map(toAction);

export function enabledModulesFromRegistry(
  registry: MeRegistry,
): Set<string> {
  return new Set(registry.modules.map((m) => m.key));
}

export type ResolveActionsOpts = {
  query?: string;
  grants?: Set<string>;
  registry: MeRegistry;
  /** Prefer DEMO grants when caller has no ACL snapshot. */
  context?: ActionContext | ActionContext[];
  /** Cap results (dock shortcuts). */
  limit?: number;
};

/**
 * Filter actions by active modules + grants + optional context + query.
 */
export function resolveActions(opts: ResolveActionsOpts): ActionDefinition[] {
  const grants = opts.grants ?? DEMO_PERMISSION_GRANTS;
  const enabledModules = enabledModulesFromRegistry(opts.registry);
  // Always allow core chrome modules even if API omits them briefly.
  enabledModules.add("home");
  enabledModules.add("settings");
  enabledModules.add("platform");

  const filtered = filterCommands(ACTION_REGISTRY, {
    query: opts.query ?? "",
    grants,
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
): { primary: ActionDefinition | null; shortcuts: ActionDefinition[] } {
  const moduleCtx = `module:${selectedModuleId}` as ActionContext;
  const forModule = resolveActions({
    registry,
    context: [moduleCtx, "dock", "home"],
    limit: limit + 2,
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

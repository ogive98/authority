import type { ActionDefinition } from "./action-registry";
import type { MeRegistry, RegistryFeature } from "./registry";
import { getFeatureMetadata } from "./feature-metadata";
import type { ShellLocale } from "@/stores/locale-store";
import { SMART_ACTIONS_MAX } from "@/stores/prefs-store";

export type FlatRegistryFeature = RegistryFeature & {
  moduleKey: string;
  moduleName: string;
};

export function featurePinKey(moduleKey: string, featureId: string): string {
  return `${moduleKey}/${featureId}`;
}

export function listRegistryFeaturesFlat(
  registry: MeRegistry,
): FlatRegistryFeature[] {
  return registry.modules.flatMap((m) =>
    m.features.map((f) => ({
      ...f,
      moduleKey: m.key,
      moduleName: m.name,
    })),
  );
}

function featureToAction(
  f: FlatRegistryFeature,
  locale: ShellLocale,
): ActionDefinition {
  const meta = getFeatureMetadata(`nav-${f.moduleKey}`, locale);
  return {
    id: featurePinKey(f.moduleKey, f.id),
    label: f.label,
    href: f.href,
    group: "navigation",
    keywords: [f.label, f.moduleName, f.id, ...(meta?.keywords ?? [])],
    contexts: ["dock", "home", `module:${f.moduleKey}`],
    dangerLevel: "none",
    moduleId: f.moduleKey,
    dockPriority: meta?.priority ?? 10,
  };
}

/**
 * Resolve pinned Smart Actions from prefs keys `module/feature`.
 * Returns [] if none pinned (caller falls back to auto ranking).
 */
export function resolvePinnedSmartActions(
  registry: MeRegistry,
  pinIds: string[],
  locale: ShellLocale = "fr",
): ActionDefinition[] {
  if (!pinIds.length) return [];
  const flat = listRegistryFeaturesFlat(registry);
  const byKey = new Map(
    flat.map((f) => [featurePinKey(f.moduleKey, f.id), f] as const),
  );
  const out: ActionDefinition[] = [];
  for (const id of pinIds.slice(0, SMART_ACTIONS_MAX)) {
    const f = byKey.get(id);
    if (!f?.href) continue;
    out.push(featureToAction(f, locale));
  }
  return out;
}

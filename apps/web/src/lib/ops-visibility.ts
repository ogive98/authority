import type { MeRegistry } from "@/lib/registry";

export type OpsVisibilityPrefs = {
  ghostHideDelivery: boolean;
  patchHideDelivery: boolean;
  patchAccountingPartial: boolean;
  ghostAccountingPartial: boolean;
};

export const OPS_VISIBILITY_DEFAULTS: OpsVisibilityPrefs = {
  ghostHideDelivery: true,
  patchHideDelivery: true,
  patchAccountingPartial: true,
  ghostAccountingPartial: false,
};

export const OPS_VISIBILITY_KEYS = {
  ghostHideDelivery: "ops.ghost.hide_delivery",
  patchHideDelivery: "ops.patch.hide_delivery",
  patchAccountingPartial: "ops.patch.accounting_partial",
  ghostAccountingPartial: "ops.ghost.accounting_partial",
} as const;

/** Features hidden when accounting is "partial" under ops mode (D180). */
const PARTIAL_ACCOUNTING_FEATURE_IDS = new Set([
  "entries",
  "journals",
  "trial-balance",
  "mapping",
  "posting",
]);

function isDeliveryModule(key: string): boolean {
  return key === "delivery" || key === "livraison";
}

function isAccountingModule(key: string): boolean {
  return key === "accounting" || key === "comptabilite" || key === "finance";
}

/**
 * Filter me-registry for active ops modes (client layer — prefs Admin later).
 * GHOST/PATCH hide BL by default; PATCH hides part of accounting by default.
 */
export function filterRegistryForOpsModes(
  registry: MeRegistry,
  opts: {
    ghostEnabled: boolean;
    patchEnabled: boolean;
    prefs: OpsVisibilityPrefs;
  },
): MeRegistry {
  const hideDelivery =
    (opts.ghostEnabled && opts.prefs.ghostHideDelivery) ||
    (opts.patchEnabled && opts.prefs.patchHideDelivery);
  const accountingPartial =
    (opts.ghostEnabled && opts.prefs.ghostAccountingPartial) ||
    (opts.patchEnabled && opts.prefs.patchAccountingPartial);

  if (!hideDelivery && !accountingPartial) return registry;

  return {
    ...registry,
    modules: registry.modules
      .filter((m) => !(hideDelivery && isDeliveryModule(m.key)))
      .map((m) => {
        if (!accountingPartial || !isAccountingModule(m.key)) return m;
        // Keep module; strip write/ledger features when present.
        // Finance stays; accounting features filtered if ids match.
        if (m.key === "accounting" || m.key === "comptabilite") {
          return {
            ...m,
            features: m.features.filter(
              (f) =>
                !PARTIAL_ACCOUNTING_FEATURE_IDS.has(f.id) &&
                !/entr[eé]e|balance|mapping|journal/i.test(f.label),
            ),
          };
        }
        return m;
      }),
  };
}

export function shouldHideDeliveryRoute(opts: {
  ghostEnabled: boolean;
  patchEnabled: boolean;
  prefs: OpsVisibilityPrefs;
}): boolean {
  return (
    (opts.ghostEnabled && opts.prefs.ghostHideDelivery) ||
    (opts.patchEnabled && opts.prefs.patchHideDelivery)
  );
}

export function isAccountingPartialMode(opts: {
  ghostEnabled: boolean;
  patchEnabled: boolean;
  prefs: OpsVisibilityPrefs;
}): boolean {
  return (
    (opts.ghostEnabled && opts.prefs.ghostAccountingPartial) ||
    (opts.patchEnabled && opts.prefs.patchAccountingPartial)
  );
}

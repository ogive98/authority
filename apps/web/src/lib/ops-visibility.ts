import type { MeRegistry } from "@/lib/registry";

/** PATCH accounting intensity preset (D203 lock 3C). */
export type PatchAccountingPreset = "none" | "partial" | "full";

/** PATCH display rules — multi-select Prefs (D203 lock 4D). */
export type PatchDisplayRule = "random" | "large_moves" | "by_date";

export const PATCH_DISPLAY_RULE_OPTIONS: {
  id: PatchDisplayRule;
  label: string;
  hint: string;
}[] = [
  {
    id: "random",
    label: "Aléatoire",
    hint:
      "Parmi les écritures du journal, en tire un sous-ensemble pseudo-aléatoire jusqu’à atteindre le % d’intensité. Utile pour une démo « bruyante » sans tri métier.",
  },
  {
    id: "large_moves",
    label: "Gros mouvements",
    hint:
      "Trie par montant décroissant puis garde le top % — les petites écritures disparaissent en premier. Utile pour montrer les gros flux clients / banque.",
  },
  {
    id: "by_date",
    label: "Par date",
    hint:
      "Priorise les écritures les plus récentes (défaut). Les anciennes sortent de l’échantillon en premier quand l’intensité baisse.",
  },
];

export type OpsVisibilityPrefs = {
  ghostHideDelivery: boolean;
  patchHideDelivery: boolean;
  /** Legacy / derived — true when preset !== full. */
  patchAccountingPartial: boolean;
  ghostAccountingPartial: boolean;
  patchAccountingPreset: PatchAccountingPreset;
  /** 0–100 — share of daily/monthly ledger visible under PATCH. */
  patchAccountingIntensity: number;
  patchDisplayRules: PatchDisplayRule[];
  /** GHOST: hide feature keys `moduleKey/featureId` (D203 lock 5A). */
  ghostHiddenFeatures: string[];
};

export const OPS_VISIBILITY_DEFAULTS: OpsVisibilityPrefs = {
  ghostHideDelivery: true,
  patchHideDelivery: true,
  patchAccountingPartial: true,
  ghostAccountingPartial: false,
  patchAccountingPreset: "partial",
  patchAccountingIntensity: 30,
  patchDisplayRules: ["by_date"],
  ghostHiddenFeatures: [],
};

export const OPS_VISIBILITY_KEYS = {
  ghostHideDelivery: "ops.ghost.hide_delivery",
  patchHideDelivery: "ops.patch.hide_delivery",
  patchAccountingPartial: "ops.patch.accounting_partial",
  ghostAccountingPartial: "ops.ghost.accounting_partial",
  patchAccountingPreset: "ops.patch.accounting_preset",
  patchAccountingIntensity: "ops.patch.accounting_intensity",
  patchDisplayRules: "ops.patch.display_rules",
  ghostHiddenFeatures: "ops.ghost.hidden_features",
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
  return key === "accounting" || key === "comptabilite";
}

export function featureHideKey(moduleKey: string, featureId: string): string {
  return `${moduleKey}/${featureId}`;
}

export function parsePatchPreset(raw: unknown): PatchAccountingPreset {
  if (raw === "none" || raw === "partial" || raw === "full") return raw;
  return OPS_VISIBILITY_DEFAULTS.patchAccountingPreset;
}

export function parsePatchIntensity(raw: unknown, fallback = 30): number {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parsePatchDisplayRules(raw: unknown): PatchDisplayRule[] {
  if (!Array.isArray(raw)) return [...OPS_VISIBILITY_DEFAULTS.patchDisplayRules];
  const allowed = new Set<PatchDisplayRule>([
    "random",
    "large_moves",
    "by_date",
  ]);
  const out: PatchDisplayRule[] = [];
  for (const item of raw) {
    if (typeof item === "string" && allowed.has(item as PatchDisplayRule)) {
      out.push(item as PatchDisplayRule);
    }
  }
  return out.length ? out : [...OPS_VISIBILITY_DEFAULTS.patchDisplayRules];
}

export function parseHiddenFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.includes("/"));
}

export function derivePatchPartial(preset: PatchAccountingPreset): boolean {
  return preset !== "full";
}

/**
 * Filter me-registry for active ops modes (D180/D203).
 * Modes are combinable (lock 2A). SPECTRE does not filter registry.
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
    (opts.patchEnabled &&
      (opts.prefs.patchAccountingPartial ||
        derivePatchPartial(opts.prefs.patchAccountingPreset)));
  const ghostHidden = new Set(
    opts.ghostEnabled ? opts.prefs.ghostHiddenFeatures : [],
  );

  if (!hideDelivery && !accountingPartial && ghostHidden.size === 0) {
    return registry;
  }

  return {
    ...registry,
    modules: registry.modules
      .filter((m) => !(hideDelivery && isDeliveryModule(m.key)))
      .map((m) => {
        let features = m.features;
        if (ghostHidden.size > 0) {
          features = features.filter(
            (f) => !ghostHidden.has(featureHideKey(m.key, f.id)),
          );
        }
        if (accountingPartial && isAccountingModule(m.key)) {
          features = features.filter(
            (f) =>
              !PARTIAL_ACCOUNTING_FEATURE_IDS.has(f.id) &&
              !/entr[eé]e|balance|mapping|journal/i.test(f.label),
          );
        }
        return { ...m, features };
      })
      .filter((m) => m.features.length > 0 || m.key === "home"),
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
    (opts.patchEnabled &&
      (opts.prefs.patchAccountingPartial ||
        derivePatchPartial(opts.prefs.patchAccountingPreset)))
  );
}

/**
 * Client-side PATCH intensity filter for journal entries (D203).
 * Pure — never invents amounts.
 */
export function filterEntriesByPatchRules<
  T extends {
    id: string;
    entryDate?: string;
    totalDebit?: string | number;
    lines?: { debit: string; credit: string }[];
  },
>(
  entries: T[],
  opts: {
    patchEnabled: boolean;
    intensity: number;
    rules: PatchDisplayRule[];
  },
): T[] {
  if (!opts.patchEnabled) return entries;
  const intensity = Math.max(0, Math.min(100, opts.intensity));
  if (intensity >= 100) return entries;
  if (intensity <= 0) return [];

  const amountOf = (e: T): number => {
    if (e.totalDebit != null) return Number(e.totalDebit);
    if (e.lines?.length) {
      return e.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    }
    return 0;
  };

  let ranked = [...entries];
  const rules = opts.rules.length
    ? opts.rules
    : (["by_date"] as PatchDisplayRule[]);

  if (rules.includes("large_moves")) {
    ranked.sort((a, b) => amountOf(b) - amountOf(a));
  } else if (rules.includes("by_date")) {
    ranked.sort((a, b) =>
      String(b.entryDate ?? "").localeCompare(String(a.entryDate ?? "")),
    );
  }

  if (rules.includes("random")) {
    ranked = [...ranked].sort((a, b) => hashStr(a.id) - hashStr(b.id));
  }

  const keep = Math.max(1, Math.ceil((ranked.length * intensity) / 100));
  return ranked.slice(0, keep);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

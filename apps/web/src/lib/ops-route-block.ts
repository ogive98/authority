import type { MeRegistry, RegistryFeature } from "@/lib/registry";
import {
  featureHideKey,
  isAccountingPartialMode,
  PARTIAL_ACCOUNTING_FEATURE_IDS,
  shouldHideDeliveryRoute,
  type OpsVisibilityPrefs,
} from "@/lib/ops-visibility";

export type OpsRouteBlock = {
  reason: "delivery" | "ghost-feature" | "accounting-partial";
  title: string;
  message: string;
  featureLabel?: string;
};

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

function parseHref(href: string): {
  pathname: string;
  tab: string | null;
  hash: string;
} {
  const u = new URL(href, "http://authority.local");
  return {
    pathname: normalizePath(u.pathname),
    tab: u.searchParams.get("tab"),
    hash: (u.hash || "").replace(/^#/, ""),
  };
}

function currentHash(hash: string): string {
  return hash.replace(/^#/, "");
}

/**
 * Score how well a feature href matches the current location.
 * Longer paths win; query tab / hash are required when present on the href.
 */
export function featureMatchScore(
  href: string,
  loc: { pathname: string; search: string; hash: string },
): number {
  const feat = parseHref(href);
  const path = normalizePath(loc.pathname);
  const tab = new URLSearchParams(
    loc.search.startsWith("?") ? loc.search.slice(1) : loc.search,
  ).get("tab");
  const hash = currentHash(loc.hash);

  if (feat.pathname === "/") {
    return path === "/" ? 1 : 0;
  }
  if (!(path === feat.pathname || path.startsWith(`${feat.pathname}/`))) {
    return 0;
  }
  if (feat.tab && feat.tab !== tab) return 0;
  if (feat.hash && feat.hash !== hash) return 0;

  let score = feat.pathname.length;
  if (feat.tab && feat.tab === tab) score += 100;
  if (feat.hash && feat.hash === hash) score += 50;
  return score;
}

export function longestMatchingFeature(
  registry: MeRegistry,
  loc: { pathname: string; search: string; hash: string },
): { moduleKey: string; feature: RegistryFeature } | null {
  let best: { score: number; moduleKey: string; feature: RegistryFeature } | null =
    null;
  for (const mod of registry.modules) {
    for (const feature of mod.features) {
      const score = featureMatchScore(feature.href, loc);
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = { score, moduleKey: mod.key, feature };
      }
    }
  }
  return best ? { moduleKey: best.moduleKey, feature: best.feature } : null;
}

function isDeliveryPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/delivery" || p.startsWith("/delivery/");
}

/**
 * Client route gate for GHOST/PATCH (D208).
 * Uses the unfiltered registry so hidden hrefs still resolve.
 */
export function resolveOpsRouteBlock(
  loc: { pathname: string; search: string; hash: string },
  registry: MeRegistry,
  opts: {
    ghostEnabled: boolean;
    patchEnabled: boolean;
    prefs: OpsVisibilityPrefs;
  },
): OpsRouteBlock | null {
  if (shouldHideDeliveryRoute(opts) && isDeliveryPath(loc.pathname)) {
    return {
      reason: "delivery",
      title: "Livraison masquée",
      message:
        "Mode GHOST / PATCH — bons de livraison masqués (préférence société). Sortie via le code calculatrice.",
    };
  }

  const hit = longestMatchingFeature(registry, loc);
  if (!hit) return null;

  const key = featureHideKey(hit.moduleKey, hit.feature.id);
  if (
    opts.ghostEnabled &&
    opts.prefs.ghostHiddenFeatures.includes(key)
  ) {
    return {
      reason: "ghost-feature",
      title: "Surface masquée",
      featureLabel: hit.feature.label,
      message: `Mode GHOST — « ${hit.feature.label} » est masqué (checklist Préférences). Sortie via le code calculatrice.`,
    };
  }

  if (
    isAccountingPartialMode(opts) &&
    (hit.moduleKey === "accounting" || hit.moduleKey === "comptabilite") &&
    PARTIAL_ACCOUNTING_FEATURE_IDS.has(hit.feature.id)
  ) {
    return {
      reason: "accounting-partial",
      title: "Comptabilité partielle",
      featureLabel: hit.feature.label,
      message: `Mode ops — « ${hit.feature.label} » retiré (vue partielle). Sortie via le code calculatrice, ou Prefs accounting_partial.`,
    };
  }

  return null;
}

/** Paths that stay reachable without a matching registry feature href. */
const REGISTRY_GATE_ALLOWLIST = [
  "/",
  "/help",
  "/settings",
  "/account",
  "/users",
  "/preview",
  "/dev",
  "/search",
] as const;

function isRegistryGateAllowlisted(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (p === "/") return true;
  return REGISTRY_GATE_ALLOWLIST.some(
    (root) => root !== "/" && (p === root || p.startsWith(`${root}/`)),
  );
}

export type RegistryRouteBlock = {
  reason: "module-inactive";
  title: string;
  message: string;
};

/**
 * UX gate when tenancy registry succeeded but the URL is outside activated modules.
 * Does not replace API authorization. Skipped when companyId is null (degraded/unauth).
 */
export function resolveRegistryRouteBlock(
  loc: { pathname: string; search: string; hash: string },
  registry: MeRegistry,
): RegistryRouteBlock | null {
  if (!registry.companyId) return null;
  if (isRegistryGateAllowlisted(loc.pathname)) return null;
  if (longestMatchingFeature(registry, loc)) return null;
  if (loc.pathname.startsWith("/m/")) {
    const key = loc.pathname.split("/")[2];
    if (key && registry.modules.some((m) => m.key === key)) return null;
  }
  return {
    reason: "module-inactive",
    title: "Module indisponible",
    message:
      "Cette surface n’est pas dans votre registre actif (module désactivé, flag, ou permission). Contactez un administrateur si vous y aviez accès.",
  };
}

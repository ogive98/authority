export type RegistryFeature = {
  id: string;
  label: string;
  href: string;
  flagKey?: string;
};

export type RegistryModule = {
  key: string;
  name: string;
  features: RegistryFeature[];
};

export type MeRegistry = {
  companyId: string | null;
  modules: RegistryModule[];
  flags: { key: string; enabled: boolean }[];
};

/**
 * Offline / API-down fallback — Utility Cube nav shape
 * (Dashboard / Sales / Inventory / Settings) mapped to AUTHORITY routes.
 */
export const FALLBACK_REGISTRY: MeRegistry = {
  companyId: null,
  modules: [
    {
      key: "home",
      name: "Tableau de bord",
      features: [
        { id: "dashboard", label: "Vue d’ensemble", href: "/" },
        { id: "preview", label: "Écrans aperçu", href: "/preview" },
      ],
    },
    {
      key: "sales",
      name: "Ventes",
      features: [
        { id: "orders", label: "Commandes", href: "/preview/commandes" },
        { id: "sales-form", label: "Prise de commande", href: "/sales" },
        { id: "customers", label: "Clients", href: "/customers" },
      ],
    },
    {
      key: "inventory",
      name: "Stock",
      features: [
        { id: "lots", label: "Lots", href: "/preview/lots" },
        { id: "inventory", label: "Inventaire", href: "/inventory" },
      ],
    },
    {
      key: "delivery",
      name: "Livraison",
      features: [
        { id: "shipments", label: "Tournées", href: "/delivery" },
      ],
    },
    {
      key: "finance",
      name: "Finance",
      features: [
        { id: "open-items", label: "Créances", href: "/finance" },
      ],
    },
    {
      key: "settings",
      name: "Paramètres",
      features: [
        { id: "prefs", label: "Préférences", href: "/settings" },
        { id: "company", label: "Société / sites", href: "/settings#company" },
      ],
    },
  ],
  flags: [],
};

/** Ensure Accueil (+ Paramètres if missing) so the icon rail never goes blank. */
export function ensureShellModules(data: MeRegistry): MeRegistry {
  if (!data.modules?.length) {
    return FALLBACK_REGISTRY;
  }
  const keys = new Set(data.modules.map((m) => m.key));
  const modules = [...data.modules];
  for (const fb of FALLBACK_REGISTRY.modules) {
    if (!keys.has(fb.key)) {
      modules.push(fb);
    }
  }
  return { ...data, modules };
}

const REGISTRY_TIMEOUT_MS = 4_000;

/**
 * Never throws — shell chrome must keep icons even when Nest is down / hangs.
 */
export async function fetchMeRegistry(): Promise<MeRegistry> {
  try {
    const res = await fetch("/api/v1/me/registry", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
    if (!res.ok) {
      return FALLBACK_REGISTRY;
    }
    const data = (await res.json()) as MeRegistry;
    return ensureShellModules(data);
  } catch {
    return FALLBACK_REGISTRY;
  }
}

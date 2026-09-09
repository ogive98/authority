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
 * Offline / API-down fallback — full Contiental nav so chrome stays usable
 * when Nest hangs (authenticated session assumed by shell layout).
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
        {
          id: "salubrita",
          label: "Certificat de salubrité",
          href: "/inventory/certificat-salubrite",
        },
        { id: "lots", label: "Lots", href: "/inventory/lots" },
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
        { id: "invoices", label: "Factures", href: "/finance/invoices" },
        { id: "payments", label: "Encaissements", href: "/finance/payments" },
        { id: "instruments", label: "Instruments", href: "/finance/instruments" },
        { id: "promises", label: "Promesses", href: "/finance/promises" },
      ],
    },
    {
      key: "tax",
      name: "Fiscalité",
      features: [{ id: "tax-catalog", label: "TVA Tunisie", href: "/tax" }],
    },
    {
      key: "hr",
      name: "Ressources humaines",
      features: [{ id: "hr-employees", label: "Employés", href: "/hr" }],
    },
    {
      key: "accounting",
      name: "Comptabilité",
      features: [
        { id: "gl", label: "Grand livre", href: "/accounting" },
      ],
    },
    {
      key: "repair",
      name: "Réparation",
      features: [
        { id: "repair-home", label: "Réparation", href: "/repair" },
        {
          id: "repair-diagnostics",
          label: "Diagnostics",
          href: "/repair#diagnostics",
        },
      ],
    },
    {
      key: "documents",
      name: "Documents",
      features: [
        { id: "library", label: "Documents", href: "/documents" },
      ],
    },
    {
      key: "products",
      name: "Produits",
      features: [
        { id: "catalogue", label: "Catalogue", href: "/products" },
      ],
    },
    {
      key: "identity",
      name: "Identité",
      features: [
        { id: "account", label: "Mon compte", href: "/account" },
        { id: "users", label: "Utilisateurs", href: "/users" },
      ],
    },
    {
      key: "settings",
      name: "Paramètres",
      features: [
        { id: "prefs", label: "Préférences", href: "/settings" },
        {
          id: "expertise",
          label: "Expertise légale",
          href: "/settings#expertise",
        },
        { id: "company", label: "Société / sites", href: "/settings#company" },
      ],
    },
  ],
  flags: [],
};

/** Unauthenticated — Accueil only (do not fake full module rail). */
export const UNAUTH_REGISTRY: MeRegistry = {
  companyId: null,
  modules: [
    {
      key: "home",
      name: "Tableau de bord",
      features: [
        { id: "dashboard", label: "Vue d’ensemble", href: "/" },
      ],
    },
  ],
  flags: [],
};

/** Ensure Accueil (+ Paramètres if missing) so the icon rail never goes blank.
 * Also merge FALLBACK features into known modules (e.g. new Inventory apps).
 */
export function ensureShellModules(data: MeRegistry): MeRegistry {
  if (!data.modules?.length) {
    return FALLBACK_REGISTRY;
  }
  const keys = new Set(data.modules.map((m) => m.key));
  const modules = data.modules.map((mod) => {
    const fb = FALLBACK_REGISTRY.modules.find((m) => m.key === mod.key);
    if (!fb?.features?.length) return mod;
    const seen = new Set(mod.features.map((f) => f.id));
    const merged = [
      ...mod.features,
      ...fb.features.filter((f) => !seen.has(f.id)),
    ];
    return merged.length === mod.features.length
      ? mod
      : { ...mod, features: merged };
  });
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
 * 401 → Accueil only (session gate should redirect; this avoids fake full nav).
 */
export async function fetchMeRegistry(): Promise<MeRegistry> {
  try {
    const res = await fetch("/api/v1/me/registry", {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return UNAUTH_REGISTRY;
    }
    if (!res.ok) {
      return FALLBACK_REGISTRY;
    }
    const data = (await res.json()) as MeRegistry;
    return ensureShellModules(data);
  } catch {
    return FALLBACK_REGISTRY;
  }
}

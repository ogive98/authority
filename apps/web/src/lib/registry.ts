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

/** Offline / API-down fallback — home + settings always for shell chrome. */
export const FALLBACK_REGISTRY: MeRegistry = {
  companyId: null,
  modules: [
    {
      key: "home",
      name: "Accueil",
      features: [
        { id: "dashboard", label: "Tableau de bord", href: "/" },
        { id: "preview", label: "Écrans aperçu", href: "/preview" },
        { id: "lots", label: "Lots", href: "/preview/lots" },
        { id: "commandes", label: "Commandes", href: "/preview/commandes" },
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

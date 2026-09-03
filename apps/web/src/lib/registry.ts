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

/** Offline / unauthenticated fallback — home + settings only. */
export const FALLBACK_REGISTRY: MeRegistry = {
  companyId: null,
  modules: [
    {
      key: "home",
      name: "Accueil",
      features: [
        { id: "dashboard", label: "Tableau de bord", href: "/" },
        { id: "tasks", label: "Tâches", href: "/#tasks" },
        { id: "alerts", label: "Alertes", href: "/#alerts" },
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

export async function fetchMeRegistry(): Promise<MeRegistry> {
  const res = await fetch("/api/v1/me/registry", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`registry ${res.status}`);
  }
  return res.json() as Promise<MeRegistry>;
}

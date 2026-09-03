import { Injectable } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { ModuleCatalogService } from './catalog/module-catalog.service';
import { FeatureFlagService } from './feature-flag.service';
import { ModuleRegistryService } from './module-registry.service';

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

export type MeRegistryResponse = {
  companyId: string | null;
  modules: RegistryModule[];
  flags: { key: string; enabled: boolean }[];
};

/** Never expose Super Admin portal in métier registry. */
const EXCLUDED_KEYS = new Set(['super-admin', 'super_admin']);

@Injectable()
export class MeRegistryService {
  constructor(
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly catalog: ModuleCatalogService,
    private readonly flags: FeatureFlagService,
  ) {}

  async buildForUser(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<MeRegistryResponse> {
    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      headers,
      cookies,
    );

    if (!companyId) {
      return {
        companyId: null,
        modules: [homeModule()],
        flags: [],
      };
    }

    const [states, flagRows] = await Promise.all([
      this.moduleRegistry.listStates(companyId),
      this.flags.listFlags(companyId),
    ]);

    const flagMap = new Map(flagRows.map((f) => [f.flagKey, f.enabled]));

    const modules: RegistryModule[] = [homeModule()];

    for (const row of states) {
      if (row.status !== ModModuleStatus.ENABLED) {
        continue;
      }
      if (EXCLUDED_KEYS.has(row.moduleKey)) {
        continue;
      }

      const manifest = this.catalog.getByKey(row.moduleKey);
      const features = buildFeatures(row.moduleKey, manifest?.name ?? row.moduleKey, manifest?.navigationEntries)
        .filter((f) => {
          if (!f.flagKey) return true;
          return flagMap.get(f.flagKey) === true;
        });

      if (features.length === 0) {
        continue;
      }

      modules.push({
        key: row.moduleKey,
        name: manifest?.name ?? row.moduleKey,
        features,
      });
    }

    return {
      companyId,
      modules,
      flags: flagRows.map((f) => ({ key: f.flagKey, enabled: f.enabled })),
    };
  }
}

function homeModule(): RegistryModule {
  return {
    key: 'home',
    name: 'Accueil',
    features: [
      { id: 'dashboard', label: 'Tableau de bord', href: '/' },
      { id: 'tasks', label: 'Tâches', href: '/#tasks' },
      { id: 'alerts', label: 'Alertes', href: '/#alerts' },
    ],
  };
}

function buildFeatures(
  moduleKey: string,
  moduleName: string,
  navigationEntries: Record<string, unknown>[] | undefined,
): RegistryFeature[] {
  const fromManifest = (navigationEntries ?? [])
    .map(parseNavEntry)
    .filter((e): e is RegistryFeature => e !== null);

  if (fromManifest.length > 0) {
    return fromManifest;
  }

  // Defaults when manifests have no navigationEntries yet
  if (moduleKey === 'settings') {
    return [
      { id: 'prefs', label: 'Préférences', href: '/settings' },
      { id: 'company', label: 'Société / sites', href: '/settings#company' },
    ];
  }

  if (moduleKey === 'platform') {
    return [
      {
        id: 'platform-overview',
        label: moduleName,
        href: '/m/platform',
      },
      {
        id: 'platform-search',
        label: 'Recherche',
        href: '/search',
        flagKey: 'platform.search',
      },
    ];
  }

  return [
    {
      id: `${moduleKey}-overview`,
      label: moduleName,
      href: `/m/${moduleKey}`,
    },
  ];
}

function parseNavEntry(raw: Record<string, unknown>): RegistryFeature | null {
  const id = typeof raw.id === 'string' ? raw.id : null;
  const label = typeof raw.label === 'string' ? raw.label : null;
  const href = typeof raw.href === 'string' ? raw.href : null;
  if (!id || !label || !href) return null;
  const flagKey =
    typeof raw.flagKey === 'string' ? raw.flagKey : undefined;
  return { id, label, href, flagKey };
}

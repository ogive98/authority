import { Injectable } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { FeatureFlagService } from '../feature-flag.service';
import { ModuleRegistryService } from '../module-registry.service';
import {
  BUSINESS_MODULE_KEYS,
  FLAG_KEYS,
  KERNEL_MODULE_KEYS,
} from '../modules.constants';
import type {
  AuthorityIndexSummary,
  IndexedCapability,
  IndexedCommand,
  IndexedConfiguration,
  IndexedDependency,
  IndexedEvent,
  IndexedExtensionPoint,
  IndexedFeature,
  IndexedModule,
  IndexedQuery,
} from './authority-index.types';
import {
  canonicalCapabilityId,
  canonicalCommandId,
  canonicalEventId,
  canonicalExtensionId,
  canonicalFeatureId,
  canonicalModuleId,
  canonicalQueryId,
} from './canonical-ids';
import { listConfigurationCatalog } from './configuration-catalog';
import { getDefaultEventContractRegistry } from './event-contract.registry';
import { deriveFeatureUi } from './feature-ui-axes';
import type { ModuleManifest } from './manifest.types';
import { ModuleCatalogService } from './module-catalog.service';
import { ModuleHookRegistry } from './module-hook.registry';

const KERNEL_SET = new Set<string>(KERNEL_MODULE_KEYS);
const BUSINESS_SET = new Set<string>(BUSINESS_MODULE_KEYS);

const INDEX_ENGINES = {
  moduleRegistry: 'live',
  featureFlags: 'live',
  capabilityRegistry: 'live',
  configuration: 'live',
  dependency: 'live',
  permissionEngine: 'live',
  eventCatalog: 'live',
  ruleEngine: 'live',
  workflowEngine: 'deferred',
  extension: 'partial',
  authorityIndex: 'live',
  aiGateway: 'stub',
} as const;

type CompanyOverlay = {
  companyId: string | null;
  enabled: Set<string>;
  flags: Map<string, boolean>;
};

@Injectable()
export class AuthorityIndexService {
  constructor(
    private readonly catalog: ModuleCatalogService,
    private readonly moduleRegistry: ModuleRegistryService,
    private readonly flags: FeatureFlagService,
    private readonly hooks: ModuleHookRegistry,
  ) {}

  async summary(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<AuthorityIndexSummary> {
    const overlay = await this.resolveOverlay(userId, headers, cookies);
    return {
      generatedAt: new Date().toISOString(),
      companyId: overlay.companyId,
      counts: {
        modules: this.catalog.list().length,
        features: this.listFeatures(overlay).length,
        capabilities: this.listCapabilities(overlay).length,
        events: this.listEvents().length,
        commands: this.listCommands().length,
        queries: this.listQueries().length,
        configuration: this.listConfiguration().length,
        extensionPoints: this.listExtensionPoints().length,
      },
      engines: { ...INDEX_ENGINES },
    };
  }

  async modules(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<IndexedModule[]> {
    const overlay = await this.resolveOverlay(userId, headers, cookies);
    return this.catalog
      .list()
      .map((manifest) => this.toModule(manifest, overlay));
  }

  async features(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<IndexedFeature[]> {
    const overlay = await this.resolveOverlay(userId, headers, cookies);
    return this.listFeatures(overlay);
  }

  async capabilities(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<IndexedCapability[]> {
    const overlay = await this.resolveOverlay(userId, headers, cookies);
    return this.listCapabilities(overlay);
  }

  listEvents(): IndexedEvent[] {
    return getDefaultEventContractRegistry()
      .list()
      .map((contract) => ({
        eventType: contract.eventType,
        canonicalId: canonicalEventId(contract.eventType),
        publisherModuleId: contract.publisherModuleId,
        version: contract.version,
        ai: { discoverable: true as const },
      }));
  }

  listDependencies(): IndexedDependency[] {
    return this.catalog.list().map((manifest) => ({
      moduleId: manifest.id,
      canonicalId: canonicalModuleId(manifest.id),
      requires: [...(manifest.dependencies ?? [])],
      optional: [...(manifest.optionalDependencies ?? [])],
    }));
  }

  listCommands(): IndexedCommand[] {
    const out: IndexedCommand[] = [];
    for (const manifest of this.catalog.list()) {
      for (const key of manifest.commands ?? []) {
        out.push({
          key,
          canonicalId: canonicalCommandId(key),
          moduleId: manifest.id,
          ai: { discoverable: true },
        });
      }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  listQueries(): IndexedQuery[] {
    const out: IndexedQuery[] = [];
    for (const manifest of this.catalog.list()) {
      for (const key of manifest.queries ?? []) {
        out.push({
          key,
          canonicalId: canonicalQueryId(key),
          moduleId: manifest.id,
          ai: { discoverable: true },
        });
      }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
  }

  listConfiguration(): IndexedConfiguration[] {
    return listConfigurationCatalog();
  }

  listExtensionPoints(): IndexedExtensionPoint[] {
    const points: IndexedExtensionPoint[] = [];
    for (const contribution of this.hooks.listContributions()) {
      const moduleId = contribution.moduleKey;
      points.push({
        id: `${moduleId}.hooks`,
        canonicalId: canonicalExtensionId(moduleId, 'hooks'),
        moduleId,
        kind: 'hook.onRegister',
        description: contribution.description ?? null,
        ai: { discoverable: true, extensible: false },
      });
      for (const checkId of contribution.healthCheckIds ?? []) {
        points.push({
          id: checkId,
          canonicalId: canonicalExtensionId(moduleId, checkId),
          moduleId,
          kind: 'hook.health',
          description: contribution.description ?? null,
          ai: { discoverable: true, extensible: false },
        });
      }
    }
    return points.sort((a, b) => a.id.localeCompare(b.id));
  }

  private listFeatures(overlay: CompanyOverlay): IndexedFeature[] {
    const features: IndexedFeature[] = [];
    for (const manifest of this.catalog.list()) {
      const moduleEnabled = overlay.enabled.has(manifest.id);
      for (const entry of manifest.navigationEntries ?? []) {
        const featureKey =
          typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
        if (!featureKey) {
          continue;
        }
        const flagKey =
          typeof entry.flagKey === 'string' ? entry.flagKey : null;
        const flagOn =
          flagKey === null ? true : overlay.flags.get(flagKey) === true;
        const required = entry.required === true;
        const derived = deriveFeatureUi({
          moduleEnabled,
          flagOn,
          required,
        });
        features.push({
          id: `${manifest.id}.${featureKey}`,
          canonicalId: canonicalFeatureId(manifest.id, featureKey),
          moduleId: manifest.id,
          label: typeof entry.label === 'string' ? entry.label : null,
          href: typeof entry.href === 'string' ? entry.href : null,
          flagKey,
          enabled: derived.ui.enabled,
          ui: derived.ui,
          flagState: derived.flagState,
          ai: { discoverable: true },
        });
      }
    }

    const platformDerived = deriveFeatureUi({
      moduleEnabled: overlay.enabled.has('platform'),
      flagOn: overlay.flags.get(FLAG_KEYS.platformSearch) === true,
    });
    features.push({
      id: 'platform.search',
      canonicalId: canonicalFeatureId('platform', 'search'),
      moduleId: 'platform',
      label: 'Search',
      href: '/search',
      flagKey: FLAG_KEYS.platformSearch,
      enabled: platformDerived.ui.enabled,
      ui: platformDerived.ui,
      flagState: platformDerived.flagState,
      ai: { discoverable: true },
    });

    return features.sort((a, b) => a.id.localeCompare(b.id));
  }

  private listCapabilities(overlay: CompanyOverlay): IndexedCapability[] {
    return this.catalog.listAllCapabilities().map((cap) => ({
      key: cap.key,
      canonicalId: canonicalCapabilityId(cap.key),
      moduleId: cap.moduleId,
      version: cap.version,
      description: cap.description ?? null,
      permissionKey: cap.permissionKey ?? null,
      riskLevel: cap.riskLevel ?? null,
      enabled: overlay.enabled.has(cap.moduleId),
      ai: { discoverable: true as const },
    }));
  }

  private toModule(
    manifest: ModuleManifest,
    overlay: CompanyOverlay,
  ): IndexedModule {
    const kernel = KERNEL_SET.has(manifest.id);
    return {
      id: manifest.id,
      canonicalId: canonicalModuleId(manifest.id),
      name: manifest.name,
      version: manifest.version,
      apiVersion: manifest.apiVersion,
      type: kernel ? 'kernel' : 'official',
      enabledByDefault: kernel,
      enabled: overlay.enabled.has(manifest.id),
      description: manifest.description ?? null,
      dependencies: [...(manifest.dependencies ?? [])],
      optionalDependencies: [...(manifest.optionalDependencies ?? [])],
      capabilityCount: manifest.capabilities.length,
      ui: { lazyLoad: BUSINESS_SET.has(manifest.id) },
      ai: { discoverable: true, configurable: !kernel },
    };
  }

  private async resolveOverlay(
    userId: string,
    headers: Record<string, string | string[] | undefined>,
    cookies: Record<string, string | undefined>,
  ): Promise<CompanyOverlay> {
    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      headers,
      cookies,
    );
    if (!companyId) {
      return { companyId: null, enabled: new Set(), flags: new Map() };
    }
    const [states, flagRows] = await Promise.all([
      this.moduleRegistry.listStates(companyId),
      this.flags.listFlags(companyId),
    ]);
    return {
      companyId,
      enabled: new Set(
        states
          .filter((row) => row.status === ModModuleStatus.ENABLED)
          .map((row) => row.moduleKey),
      ),
      flags: new Map(flagRows.map((row) => [row.flagKey, row.enabled])),
    };
  }
}

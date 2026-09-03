import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { ModuleRegistryService } from '../module-registry.service';
import { BUSINESS_MODULE_KEYS, KERNEL_MODULE_KEYS } from '../modules.constants';
import type { CapabilityDef, ModuleManifest } from './manifest.types';
import {
  assertCatalogIntegrity,
  assertModuleManifest,
  CatalogValidationError,
  CATALOG_ERROR_CODES,
} from './manifest.validator';
import { STATIC_MODULE_MANIFESTS } from './manifests';

const SEEDED_MODULE_KEYS = [
  ...KERNEL_MODULE_KEYS,
  ...BUSINESS_MODULE_KEYS,
] as const;

@Injectable()
export class ModuleCatalogService implements OnModuleInit {
  private readonly byId = new Map<string, ModuleManifest>();
  private readonly capabilitiesByKey = new Map<string, CapabilityDef>();
  private readonly capabilitiesByModule = new Map<string, CapabilityDef[]>();

  constructor(private readonly moduleRegistry: ModuleRegistryService) {}

  onModuleInit(): void {
    this.load(STATIC_MODULE_MANIFESTS);
  }

  /** Test / boot helper — validates then replaces in-memory catalog. */
  load(rawManifests: readonly unknown[]): void {
    const manifests = rawManifests.map((raw) => assertModuleManifest(raw));
    assertCatalogIntegrity(manifests);
    this.assertSeededCoverage(manifests);

    this.byId.clear();
    this.capabilitiesByKey.clear();
    this.capabilitiesByModule.clear();

    for (const manifest of manifests) {
      this.byId.set(manifest.id, manifest);
      this.capabilitiesByModule.set(manifest.id, [...manifest.capabilities]);
      for (const cap of manifest.capabilities) {
        this.capabilitiesByKey.set(cap.key, cap);
      }
    }
  }

  getByKey(moduleId: string): ModuleManifest | undefined {
    return this.byId.get(moduleId);
  }

  list(): ModuleManifest[] {
    return [...this.byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  capabilitiesFor(moduleId: string): CapabilityDef[] {
    return [...(this.capabilitiesByModule.get(moduleId) ?? [])];
  }

  getCapability(key: string): CapabilityDef | undefined {
    return this.capabilitiesByKey.get(key);
  }

  listAllCapabilities(): CapabilityDef[] {
    return [...this.capabilitiesByKey.values()].sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  }

  /**
   * Catalog ∩ ModModuleState.ENABLED for the company.
   * Manifest describes what a module is; ModModuleState decides if it is active.
   * Uses a single listStates read (not N×isEnabled) to avoid discovery N+1.
   */
  async listEffectiveCapabilities(companyId: string): Promise<CapabilityDef[]> {
    const states = await this.moduleRegistry.listStates(companyId);
    const enabled = new Set(
      states
        .filter((row) => row.status === ModModuleStatus.ENABLED)
        .map((row) => row.moduleKey),
    );
    return this.listAllCapabilities().filter((cap) =>
      enabled.has(cap.moduleId),
    );
  }

  private assertSeededCoverage(manifests: ModuleManifest[]): void {
    const ids = new Set(manifests.map((m) => m.id));
    for (const key of SEEDED_MODULE_KEYS) {
      if (!ids.has(key)) {
        throw new CatalogValidationError(
          CATALOG_ERROR_CODES.INVALID_MANIFEST,
          `Static catalog missing seeded module key: ${key}`,
        );
      }
    }
    if (manifests.length !== SEEDED_MODULE_KEYS.length) {
      throw new CatalogValidationError(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
        `Static catalog must contain exactly ${SEEDED_MODULE_KEYS.length} modules (got ${manifests.length})`,
      );
    }
  }
}

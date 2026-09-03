import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { ModuleRegistryService } from '../module-registry.service';
import { ModuleCatalogService } from './module-catalog.service';
import type {
  CompanyModuleHealthView,
  ModuleLifecycleState,
  ProcessLifecycleView,
} from './module-lifecycle.types';

@Injectable()
export class ModuleLifecycleService implements OnModuleInit {
  private readonly processStates = new Map<string, ProcessLifecycleView>();

  constructor(
    private readonly catalog: ModuleCatalogService,
    private readonly modules: ModuleRegistryService,
  ) {}

  onModuleInit(): void {
    this.recomputeProcessLifecycle();
  }

  /** Recompute after catalog reload (tests / future hot reload). */
  recomputeProcessLifecycle(): void {
    this.processStates.clear();
    const manifests = this.catalog.list();
    const ids = new Set(manifests.map((m) => m.id));

    // Pass 1: validate structure
    for (const manifest of manifests) {
      const missingRequired = (manifest.dependencies ?? []).filter(
        (dep) => !ids.has(dep),
      );
      const missingOptional = (manifest.optionalDependencies ?? []).filter(
        (dep) => !ids.has(dep),
      );

      let state: ModuleLifecycleState = 'DISCOVERED';
      let reason: string | undefined;

      state = 'VALIDATING';
      if (missingRequired.length > 0) {
        state = 'ERROR';
        reason = `Missing required dependencies: ${missingRequired.join(', ')}`;
      } else {
        state = 'REGISTERED';
      }

      this.processStates.set(manifest.id, {
        moduleId: manifest.id,
        state,
        missingRequiredDependencies: missingRequired,
        missingOptionalDependencies: missingOptional,
        reason,
      });
    }

    // Pass 2: READY vs DEGRADED for REGISTERED modules
    for (const manifest of manifests) {
      const current = this.processStates.get(manifest.id);
      if (!current || current.state === 'ERROR') {
        continue;
      }

      const optionalMissing = current.missingOptionalDependencies;
      if (optionalMissing.length > 0) {
        this.processStates.set(manifest.id, {
          ...current,
          state: 'DEGRADED',
          reason: `Missing optional dependencies: ${optionalMissing.join(', ')}`,
        });
      } else {
        this.processStates.set(manifest.id, {
          ...current,
          state: 'READY',
          reason: undefined,
        });
      }
    }
  }

  getProcessState(moduleId: string): ProcessLifecycleView | undefined {
    return this.processStates.get(moduleId);
  }

  listProcessStates(): ProcessLifecycleView[] {
    return [...this.processStates.values()].sort((a, b) =>
      a.moduleId.localeCompare(b.moduleId),
    );
  }

  /**
   * Company health: activation from ModModuleState; deps from ENABLED peers.
   * Does not mutate Prisma.
   */
  async evaluateCompanyHealth(
    companyId: string,
    moduleId: string,
  ): Promise<CompanyModuleHealthView> {
    const process =
      this.getProcessState(moduleId) ??
      ({
        moduleId,
        state: 'ERROR' as const,
        missingRequiredDependencies: [],
        missingOptionalDependencies: [],
        reason: 'Module not in process catalog',
      } satisfies ProcessLifecycleView);

    if (process.state === 'ERROR') {
      return {
        moduleId,
        activation: 'MISSING',
        health: 'ERROR',
        processState: process.state,
        missingRequiredDependencies: process.missingRequiredDependencies,
        missingOptionalDependencies: process.missingOptionalDependencies,
        reason: process.reason,
      };
    }

    const states = await this.modules.listStates(companyId);
    const byKey = new Map(states.map((row) => [row.moduleKey, row.status]));
    const activationStatus = byKey.get(moduleId);
    const activation: CompanyModuleHealthView['activation'] = activationStatus
      ? activationStatus === ModModuleStatus.ENABLED
        ? 'ENABLED'
        : 'DISABLED'
      : 'MISSING';

    if (activation !== 'ENABLED') {
      return {
        moduleId,
        activation,
        health: 'INACTIVE',
        processState: process.state,
        missingRequiredDependencies: [],
        missingOptionalDependencies: [],
        reason: 'Module not ENABLED for company',
      };
    }

    const manifest = this.catalog.getByKey(moduleId);
    const required = manifest?.dependencies ?? [];
    const optional = manifest?.optionalDependencies ?? [];

    const missingRequired = required.filter(
      (dep) => byKey.get(dep) !== ModModuleStatus.ENABLED,
    );
    const missingOptional = optional.filter(
      (dep) => byKey.get(dep) !== ModModuleStatus.ENABLED,
    );

    if (missingRequired.length > 0) {
      return {
        moduleId,
        activation,
        health: 'BLOCKED',
        processState: process.state,
        missingRequiredDependencies: missingRequired,
        missingOptionalDependencies: missingOptional,
        reason: `Required dependencies not ENABLED: ${missingRequired.join(', ')}`,
      };
    }

    if (missingOptional.length > 0 || process.state === 'DEGRADED') {
      return {
        moduleId,
        activation,
        health: 'DEGRADED',
        processState: process.state,
        missingRequiredDependencies: [],
        missingOptionalDependencies: missingOptional,
        reason:
          missingOptional.length > 0
            ? `Optional dependencies not ENABLED: ${missingOptional.join(', ')}`
            : process.reason,
      };
    }

    return {
      moduleId,
      activation,
      health: 'READY',
      processState: process.state,
      missingRequiredDependencies: [],
      missingOptionalDependencies: [],
    };
  }

  /** Preview for CAP-04 ENABLE — required deps must be ENABLED. */
  async canEnable(
    companyId: string,
    moduleId: string,
  ): Promise<{ ok: boolean; missingRequiredDependencies: string[] }> {
    const manifest = this.catalog.getByKey(moduleId);
    if (!manifest) {
      return { ok: false, missingRequiredDependencies: [moduleId] };
    }
    const process = this.getProcessState(moduleId);
    if (!process || process.state === 'ERROR') {
      return {
        ok: false,
        missingRequiredDependencies: process?.missingRequiredDependencies ?? [
          moduleId,
        ],
      };
    }

    const states = await this.modules.listStates(companyId);
    const enabled = new Set(
      states
        .filter((row) => row.status === ModModuleStatus.ENABLED)
        .map((row) => row.moduleKey),
    );
    const missingRequired = (manifest.dependencies ?? []).filter(
      (dep) => !enabled.has(dep),
    );
    return {
      ok: missingRequired.length === 0,
      missingRequiredDependencies: missingRequired,
    };
  }
}

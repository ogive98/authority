import { Injectable } from '@nestjs/common';
import { EntitlementEvaluatorService } from '../../entitlements/entitlement-evaluator.service';
import { PermissionService } from '../../permissions/permission.service';
import { ModuleRegistryService } from '../module-registry.service';
import { CAPABILITY_ERROR_CODES } from '../modules.constants';
import { ModuleCatalogService } from './module-catalog.service';
import type {
  CapabilityResolveContext,
  CapabilityResolveResult,
} from './capability-resolve.types';

/**
 * CAP-02 capability resolution.
 * Entitlements via EntitlementEvaluatorService (license-stub until Control).
 */
@Injectable()
export class CapabilityResolverService {
  constructor(
    private readonly catalog: ModuleCatalogService,
    private readonly modules: ModuleRegistryService,
    private readonly permissions: PermissionService,
    private readonly entitlements: EntitlementEvaluatorService,
  ) {}

  async resolve(
    capabilityKey: string,
    context: CapabilityResolveContext,
  ): Promise<CapabilityResolveResult> {
    const capability = this.catalog.getCapability(capabilityKey);
    if (!capability) {
      return deny(
        CAPABILITY_ERROR_CODES.UNKNOWN,
        `Unknown capability: ${capabilityKey}`,
        capabilityKey,
      );
    }

    const manifest = this.catalog.getByKey(capability.moduleId);
    if (!manifest) {
      return deny(
        CAPABILITY_ERROR_CODES.MODULE_UNREGISTERED,
        `Module not registered: ${capability.moduleId}`,
        capabilityKey,
        capability.moduleId,
      );
    }

    const enabled = await this.modules.isEnabled(
      context.companyId,
      capability.moduleId,
    );
    if (!enabled) {
      return deny(
        CAPABILITY_ERROR_CODES.MODULE_DISABLED,
        `Module disabled: ${capability.moduleId}`,
        capabilityKey,
        capability.moduleId,
      );
    }

    const entitled = await this.entitlements.assertCapability(
      context.companyId,
      capabilityKey,
      capability.moduleId,
    );
    if (!entitled.allowed) {
      return deny(
        CAPABILITY_ERROR_CODES.LICENSE_DENIED,
        entitled.reason ?? `Entitlement denies capability: ${capabilityKey}`,
        capabilityKey,
        capability.moduleId,
      );
    }

    if (capability.permissionKey) {
      if (!context.userId) {
        return deny(
          CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
          `Permission required: ${capability.permissionKey}`,
          capabilityKey,
          capability.moduleId,
        );
      }
      const permitted = await this.permissions.evaluate(
        context.userId,
        capability.permissionKey,
        {
          companyId: context.companyId,
          siteId: context.siteId,
        },
      );
      if (!permitted) {
        return deny(
          CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
          `Permission denied: ${capability.permissionKey}`,
          capabilityKey,
          capability.moduleId,
        );
      }
    }

    return {
      allowed: true,
      capabilityKey,
      moduleId: capability.moduleId,
    };
  }
}

function deny(
  code: string,
  message: string,
  capabilityKey: string,
  moduleId?: string,
): CapabilityResolveResult {
  return {
    allowed: false,
    code,
    message,
    capabilityKey,
    moduleId,
  };
}

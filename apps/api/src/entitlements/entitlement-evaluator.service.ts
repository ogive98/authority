import { Injectable } from '@nestjs/common';
import { LICENSE_STATUSES } from '../license/license.constants';
import { LicenseException } from '../license/license.exception';
import { LicenseService } from '../license/license.service';
import type {
  EntitlementDecision,
  EntitlementSnapshot,
  EntitlementStatus,
} from './entitlement.types';

export const ENTITLEMENT_ERROR_CODES = {
  DENIED: 'ENT.DENIED',
  INVALID: 'ENT.INVALID',
} as const;

/**
 * Terrain stub for Control Plane entitlements (D060/01d).
 * Source remains license-stub until CTRL-01 sync.
 */
@Injectable()
export class EntitlementEvaluatorService {
  constructor(private readonly license: LicenseService) {}

  async getSnapshot(companyId?: string): Promise<EntitlementSnapshot> {
    const denyModuleKeys = parseDenyList(
      process.env.THUNDER_ENTITLEMENT_DENY_MODULES,
    );

    try {
      const license = await this.license.getStatus(companyId);
      const status = mapLicenseStatus(license.status);
      return {
        companyId: companyId ?? license.companyId,
        plan: license.plan,
        status,
        allowedModuleKeys: '*',
        allowedCapabilityKeys: '*',
        source: 'license-stub',
        expiresAt: license.expiresAt,
        denyModuleKeys,
      };
    } catch (error) {
      const status: EntitlementStatus =
        error instanceof LicenseException ? 'invalid' : 'missing';
      return {
        companyId: companyId ?? null,
        plan: 'unknown',
        status,
        allowedModuleKeys: [],
        allowedCapabilityKeys: [],
        source: 'license-stub',
        expiresAt: null,
        denyModuleKeys,
      };
    }
  }

  async assertModule(
    companyId: string,
    moduleKey: string,
  ): Promise<EntitlementDecision> {
    const snapshot = await this.getSnapshot(companyId);
    if (snapshot.status !== 'active' && snapshot.status !== 'grace') {
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.INVALID,
        reason: `Entitlement status: ${snapshot.status}`,
        snapshot,
      };
    }
    if (snapshot.denyModuleKeys.includes(moduleKey)) {
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.DENIED,
        reason: `Module denied by entitlement stub: ${moduleKey}`,
        snapshot,
      };
    }
    if (
      snapshot.allowedModuleKeys !== '*' &&
      !snapshot.allowedModuleKeys.includes(moduleKey)
    ) {
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.DENIED,
        reason: `Module not in entitlement allow-list: ${moduleKey}`,
        snapshot,
      };
    }
    return { allowed: true, snapshot };
  }

  async assertCapability(
    companyId: string,
    capabilityKey: string,
    moduleId: string,
  ): Promise<EntitlementDecision> {
    const moduleDecision = await this.assertModule(companyId, moduleId);
    if (!moduleDecision.allowed) {
      return moduleDecision;
    }
    const { snapshot } = moduleDecision;
    if (
      snapshot.allowedCapabilityKeys !== '*' &&
      !snapshot.allowedCapabilityKeys.includes(capabilityKey)
    ) {
      return {
        allowed: false,
        code: ENTITLEMENT_ERROR_CODES.DENIED,
        reason: `Capability not in entitlement allow-list: ${capabilityKey}`,
        snapshot,
      };
    }
    return { allowed: true, snapshot };
  }
}

function mapLicenseStatus(status: string): EntitlementStatus {
  if (status === LICENSE_STATUSES.active) {
    return 'active';
  }
  if (status === LICENSE_STATUSES.grace) {
    return 'grace';
  }
  if (status === LICENSE_STATUSES.expired) {
    return 'expired';
  }
  return 'invalid';
}

function parseDenyList(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

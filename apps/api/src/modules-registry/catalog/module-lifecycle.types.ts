/**
 * Process / company runtime lifecycle — separate from ModModuleStatus.
 * ModModuleStatus remains ENABLED | DISABLED only.
 */
export const MODULE_LIFECYCLE_STATES = [
  'DISCOVERED',
  'VALIDATING',
  'REGISTERED',
  'READY',
  'DEGRADED',
  'ERROR',
] as const;

export type ModuleLifecycleState = (typeof MODULE_LIFECYCLE_STATES)[number];

/** Company-scoped health combining catalog lifecycle + ModModuleState + deps. */
export const MODULE_COMPANY_HEALTH = [
  'INACTIVE',
  'READY',
  'DEGRADED',
  'BLOCKED',
  'ERROR',
] as const;

export type ModuleCompanyHealth = (typeof MODULE_COMPANY_HEALTH)[number];

export interface ProcessLifecycleView {
  moduleId: string;
  state: ModuleLifecycleState;
  missingRequiredDependencies: string[];
  missingOptionalDependencies: string[];
  reason?: string;
}

export interface CompanyModuleHealthView {
  moduleId: string;
  activation: 'ENABLED' | 'DISABLED' | 'MISSING';
  health: ModuleCompanyHealth;
  processState: ModuleLifecycleState;
  missingRequiredDependencies: string[];
  missingOptionalDependencies: string[];
  reason?: string;
}

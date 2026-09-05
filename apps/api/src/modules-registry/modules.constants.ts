export const KERNEL_MODULE_KEYS = [
  'platform',
  'identity',
  'organization',
  'settings',
  'monitoring',
] as const;

export const BUSINESS_MODULE_KEYS = [
  'sales',
  'inventory',
  'delivery',
  'production',
  'payroll',
  'customers',
  'master_data',
  'products',
  'portals',
] as const;

export const FLAG_KEYS = {
  platformSearch: 'platform.search',
} as const;

export const MODULE_METADATA_KEY = 'authority:module';
export const FLAG_METADATA_KEY = 'authority:flag';
export const CAPABILITY_METADATA_KEY = 'authority:capability';

export const MODULE_ERROR_CODES = {
  DISABLED: 'MOD.DISABLED',
  FLAG_OFF: 'MOD.FLAG_OFF',
  UNKNOWN_MODULE: 'MOD.UNKNOWN_MODULE',
  COMPANY_NOT_FOUND: 'MOD.COMPANY_NOT_FOUND',
  DEPS_MISSING: 'MOD.DEPS_MISSING',
  HAS_DEPENDENTS: 'MOD.HAS_DEPENDENTS',
} as const;

export const CAPABILITY_ERROR_CODES = {
  UNKNOWN: 'CAP.UNKNOWN',
  MODULE_UNREGISTERED: 'CAP.MODULE_UNREGISTERED',
  MODULE_DISABLED: 'CAP.MODULE_DISABLED',
  LICENSE_DENIED: 'CAP.LICENSE_DENIED',
  PERMISSION_DENIED: 'CAP.PERMISSION_DENIED',
} as const;

export function moduleKeyForFlag(flagKey: string): string {
  const [moduleKey] = flagKey.split('.');
  return moduleKey ?? flagKey;
}

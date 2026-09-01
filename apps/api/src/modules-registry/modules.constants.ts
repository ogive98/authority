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
  'production',
  'payroll',
  'customers',
  'master_data',
] as const;

export const FLAG_KEYS = {
  platformSearch: 'platform.search',
} as const;

export const MODULE_METADATA_KEY = 'authority:module';
export const FLAG_METADATA_KEY = 'authority:flag';

export const MODULE_ERROR_CODES = {
  DISABLED: 'MOD.DISABLED',
  FLAG_OFF: 'MOD.FLAG_OFF',
} as const;

export function moduleKeyForFlag(flagKey: string): string {
  const [moduleKey] = flagKey.split('.');
  return moduleKey ?? flagKey;
}

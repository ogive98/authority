import { SetLevel } from '@prisma/client';

export const SETTINGS_ERROR_CODES = {
  INVALID: 'SET.INVALID',
  FORBIDDEN_LEVEL: 'SET.FORBIDDEN_LEVEL',
} as const;

export type SettingsErrorCode =
  (typeof SETTINGS_ERROR_CODES)[keyof typeof SETTINGS_ERROR_CODES];

export const SETTING_LEVEL_PRIORITY: Record<SetLevel, number> = {
  SYSTEM: 0,
  COMPANY: 1,
  ROLE: 2,
  USER: 3,
};

export const SETTINGS_AUDIT_ACTIONS = {
  valueUpdated: 'settings.value.update',
} as const;

export const SETTINGS_ENTITY_TYPES = {
  setValue: 'set_value',
} as const;

export const SETTINGS_SCOPE = {
  system: 'system',
} as const;

export function buildScopeKey(
  level: SetLevel,
  params: { companyId?: string; subjectId?: string },
): string {
  switch (level) {
    case SetLevel.SYSTEM:
      return SETTINGS_SCOPE.system;
    case SetLevel.COMPANY:
      return `company:${params.companyId}`;
    case SetLevel.ROLE:
      return `role:${params.companyId}:${params.subjectId}`;
    case SetLevel.USER:
      return `user:${params.companyId}:${params.subjectId}`;
    default:
      return SETTINGS_SCOPE.system;
  }
}

export const KERNEL_SETTING_KEYS = [
  'ui.locale',
  'ui.theme',
  'ui.density',
] as const;

export type KernelSettingKey = (typeof KERNEL_SETTING_KEYS)[number];

export const SETTING_ENUM_VALUES: Record<KernelSettingKey, readonly string[]> =
  {
    'ui.locale': ['fr-TN', 'en-US', 'ar-TN'],
    'ui.theme': ['light', 'dark', 'system'],
    'ui.density': ['compact', 'comfortable'],
  };

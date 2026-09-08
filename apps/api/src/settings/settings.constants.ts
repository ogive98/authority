import { SetLevel } from '@prisma/client';

export const SETTINGS_ERROR_CODES = {
  INVALID: 'SET.INVALID',
  FORBIDDEN_LEVEL: 'SET.FORBIDDEN_LEVEL',
  EXPERTISE_READONLY: 'SET.EXPERTISE_READONLY',
  EXPERTISE_REQUIRED: 'SET.EXPERTISE_REQUIRED',
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

/**
 * Legal / fiscal expertise slots hosted under Préférences (D090).
 * Rates are NEVER invented here — PENDING until expert validation.
 * VAT is owned by Tax Engine (`/tax`); other kinds wait for expert input.
 */
export const EXPERTISE_SLOT_KEYS = [
  'tax.vat',
  'tax.fodec',
  'tax.timbre',
  'hr.cnss',
  'hr.irpp',
  'hr.tfp',
] as const;

export type ExpertiseSlotKey = (typeof EXPERTISE_SLOT_KEYS)[number];

export type ExpertiseDomain = 'tax' | 'hr' | 'payroll';

export type ExpertiseSlotStatus =
  | 'VALIDATED'
  | 'PENDING_EXPERT'
  | 'NOT_APPLICABLE';

export type ExpertiseSlotDef = {
  key: ExpertiseSlotKey;
  domain: ExpertiseDomain;
  label: string;
  description: string;
  /** Default status before live enrichment (VAT may become VALIDATED). */
  defaultStatus: ExpertiseSlotStatus;
  lawRefHint: string | null;
  manageHref: string | null;
};

export const EXPERTISE_CATALOG: readonly ExpertiseSlotDef[] = [
  {
    key: 'tax.vat',
    domain: 'tax',
    label: 'TVA Tunisie',
    description:
      'Catalogue Code TVA (7 / 13 / 19 / 0 %) — Tax Engine D088.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: 'Code TVA · LF2018 art.43',
    manageHref: '/tax',
  },
  {
    key: 'tax.fodec',
    domain: 'tax',
    label: 'FODEC',
    description:
      'Fonds de développement de la compétitivité — taux après validation expert.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: null,
  },
  {
    key: 'tax.timbre',
    domain: 'tax',
    label: 'Timbre fiscal',
    description: 'Droit de timbre — montants après validation expert.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: null,
  },
  {
    key: 'hr.cnss',
    domain: 'hr',
    label: 'CNSS',
    description:
      'Cotisations sociales — taux employeur/salarié après expert (Payroll).',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.irpp',
    domain: 'hr',
    label: 'IRPP',
    description: 'Barème IRPP — après validation expert (Payroll).',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.tfp',
    domain: 'hr',
    label: 'TFP',
    description: 'Taxe sur la formation professionnelle — après expert.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: null,
  },
] as const;

/** Slots writable via Préférences (VAT remains Tax Engine only). */
export const EXPERTISE_WRITABLE_KEYS = [
  'tax.fodec',
  'tax.timbre',
  'hr.cnss',
  'hr.irpp',
  'hr.tfp',
] as const;

export type ExpertiseWritableKey = (typeof EXPERTISE_WRITABLE_KEYS)[number];

export function isExpertiseWritableKey(
  key: string,
): key is ExpertiseWritableKey {
  return (EXPERTISE_WRITABLE_KEYS as readonly string[]).includes(key);
}

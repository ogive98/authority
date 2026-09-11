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

/** Never echoed in getEffective / audit payloads (D137). Empty PUT keeps previous. */
export const SECRET_SETTING_KEYS = [
  'identity.smtp.pass',
  'finance.dunning.smtp.pass',
  'finance.dunning.wa.access_token',
] as const;

/** Company-scoped only — no USER override (D170/D180/D194). */
export const COMPANY_ONLY_SETTING_KEYS = [
  'ops.unlock_code',
  'ops.ghost.hide_delivery',
  'ops.patch.hide_delivery',
  'ops.patch.accounting_partial',
  'ops.ghost.accounting_partial',
  'finance.collection.remind_days',
  'finance.credit.warn_ratio',
  'finance.dunning.smtp.host',
  'finance.dunning.smtp.port',
  'finance.dunning.smtp.secure',
  'finance.dunning.smtp.user',
  'finance.dunning.smtp.pass',
  'finance.dunning.smtp.from',
  'finance.dunning.wa.phone_number_id',
  'finance.dunning.wa.access_token',
  'finance.dunning.wa.api_version',
  'finance.dunning.wa.template_name',
  'finance.dunning.wa.template_language',
  'finance.dunning.wa.template_body_params',
] as const;

export function isCompanyOnlySettingKey(key: string): boolean {
  return (COMPANY_ONLY_SETTING_KEYS as readonly string[]).includes(key);
}

/** Ops calculator unlock PIN (D162/D170). */
export const OPS_UNLOCK_CODE_KEY = 'ops.unlock_code';
export const OPS_UNLOCK_CODE_DEFAULT = '3141';

/** Ops visibility — defaults match GHOST/PATCH product intent (D180). Prefs Admin later. */
export const OPS_VISIBILITY_SETTING_KEYS = {
  GHOST_HIDE_DELIVERY: 'ops.ghost.hide_delivery',
  PATCH_HIDE_DELIVERY: 'ops.patch.hide_delivery',
  PATCH_ACCOUNTING_PARTIAL: 'ops.patch.accounting_partial',
  GHOST_ACCOUNTING_PARTIAL: 'ops.ghost.accounting_partial',
} as const;

export const OPS_VISIBILITY_DEFAULTS: Record<
  (typeof OPS_VISIBILITY_SETTING_KEYS)[keyof typeof OPS_VISIBILITY_SETTING_KEYS],
  boolean
> = {
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY]: true,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY]: true,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL]: true,
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL]: false,
};

export function normalizeOpsUnlockCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\D/g, '').slice(0, 12);
  if (cleaned.length < 4) return null;
  return cleaned;
}

export function isSecretSettingKey(key: string): boolean {
  return (SECRET_SETTING_KEYS as readonly string[]).includes(key);
}

export function isSecretValueSet(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

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
  'hr.cnss.employee',
  'hr.cnss.employer',
  'hr.cnss.ceiling',
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
    key: 'hr.cnss.employee',
    domain: 'hr',
    label: 'CNSS salarié',
    description:
      'Taux part salarié (rateBps) — vide jusqu’à saisie expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.cnss.employer',
    domain: 'hr',
    label: 'CNSS employeur',
    description:
      'Taux part employeur (rateBps) — vide jusqu’à saisie expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.cnss.ceiling',
    domain: 'hr',
    label: 'CNSS plafond',
    description:
      'Plafond assiette mensuelle (amountMilli) — vide jusqu’à saisie expert.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.irpp',
    domain: 'hr',
    label: 'IRPP',
    description:
      'Barème IRPP annuel (table hr_irpp_bracket) — VALIDATED + tranches saisies expert. Jamais seedé. Méthode retenue: annuel/12.',
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
  'hr.cnss.employee',
  'hr.cnss.employer',
  'hr.cnss.ceiling',
  'hr.irpp',
  'hr.tfp',
] as const;

export type ExpertiseWritableKey = (typeof EXPERTISE_WRITABLE_KEYS)[number];

export function isExpertiseWritableKey(
  key: string,
): key is ExpertiseWritableKey {
  return (EXPERTISE_WRITABLE_KEYS as readonly string[]).includes(key);
}

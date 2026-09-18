import { SetLevel } from '@prisma/client';

export const SETTINGS_ERROR_CODES = {
  INVALID: 'SET.INVALID',
  FORBIDDEN_LEVEL: 'SET.FORBIDDEN_LEVEL',
  EXPERTISE_READONLY: 'SET.EXPERTISE_READONLY',
  EXPERTISE_REQUIRED: 'SET.EXPERTISE_REQUIRED',
  EXPERTISE_STUB_MARKER: 'SET.EXPERTISE_STUB_MARKER',
  PLAN_NOT_FOUND: 'SET.PLAN_NOT_FOUND',
  PLAN_INVALID: 'SET.PLAN_INVALID',
  PLAN_STATE: 'SET.PLAN_STATE',
  PLAN_APPROVAL_REQUIRED: 'SET.PLAN_APPROVAL_REQUIRED',
  PLAN_SAME_APPROVER: 'SET.PLAN_SAME_APPROVER',
  PLAN_DUAL_CONTROL_REQUIRED: 'SET.PLAN_DUAL_CONTROL_REQUIRED',
  PLAN_ROLLBACK_UNAVAILABLE: 'SET.PLAN_ROLLBACK_UNAVAILABLE',
  SITE_REQUIRED: 'SET.SITE_REQUIRED',
  DOCUMENT_TYPE_REQUIRED: 'SET.DOCUMENT_TYPE_REQUIRED',
} as const;

export type SettingsErrorCode =
  (typeof SETTINGS_ERROR_CODES)[keyof typeof SETTINGS_ERROR_CODES];

/** Seed / demo marker — AUTHORITY must not show these as « Validé expert » (D280). */
export const STUB_UNTIL_EXPERT_MARKER = 'STUB_UNTIL_EXPERT';

export function isStubUntilExpert(
  lawRef?: string | null,
  notes?: string | null,
): boolean {
  return Boolean(
    lawRef?.includes(STUB_UNTIL_EXPERT_MARKER) ||
      notes?.includes(STUB_UNTIL_EXPERT_MARKER),
  );
}

export const SETTING_LEVEL_PRIORITY: Record<SetLevel, number> = {
  SYSTEM: 0,
  COMPANY: 1,
  SITE: 2,
  DOCUMENT: 3,
  ROLE: 4,
  USER: 5,
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
  'finance.dunning.wa.app_secret',
] as const;

/** Company-scoped only — no USER override (D170/D180/D194/D203). */
export const COMPANY_ONLY_SETTING_KEYS = [
  'ops.unlock_code',
  'ops.ghost.hide_delivery',
  'ops.patch.hide_delivery',
  'ops.patch.accounting_partial',
  'ops.ghost.accounting_partial',
  'ops.patch.accounting_preset',
  'ops.patch.accounting_intensity',
  'ops.patch.display_rules',
  'ops.ghost.hidden_features',
  'finance.collection.remind_days',
  'finance.credit.warn_ratio',
  'finance.credit.enforce',
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
  'finance.dunning.wa.verify_token',
  'finance.dunning.wa.app_secret',
  'accounting.gl.ar',
  'accounting.gl.bank',
  'accounting.gl.revenue',
  'accounting.gl.vat',
  'accounting.gl.ap',
  'accounting.gl.expense',
  'accounting.gl.bank_fee',
  'accounting.gl.sales_journal',
  'accounting.gl.bank_journal',
  'accounting.gl.purchases_journal',
  'sales.reserve_on_confirm',
  'sales.auto_confirm_on_create',
  'sales.require_requested_date',
  'sales.allow_manual_price',
  'sales.default_currency',
  'inventory.daily_lot_gen.hour_tunis',
  'inventory.daily_lot_gen.tz',
  'hr.contract.letterhead',
  'hr.contract.body_html',
  'hr.contract.footer',
  'hr.attestation.letterhead',
  'hr.attestation.body_html',
  'hr.attestation.footer',
  'backup.enabled',
  'backup.defaultType',
  'backup.preActionSnapshot.enabled',
  'backup.destination.primary',
  'backup.restore.requireElevatedPermission',
  'backup.retention.enabled',
  'backup.retention.keepDays',
  'backup.retention.lockedNeverDelete',
  'backup.schedule.enabled',
  'backup.schedule.hourTunis',
  'backup.restore.safetyBackup.required',
  'backup.autoBackup.enabled',
  'backup.autoBackup.hourTunis',
  'backup.autoBackup.scope',
  'backup.specificFolders.enabled',
  'backup.specificFolders.defaultSelection',
  'backup.specificFolders.allowUserSelection',
  'backup.specificFolders.followSymlinks',
  'backup.specificFolders.includePatterns',
  'backup.specificFolders.excludePatterns',
  'backup.specificFolders.maxSize',
  'backup.specificFolders.verifyAfterBackup',
  'backup.specificFolders.auto.enabled',
  'backup.specificFolders.auto.hourTunis',
  'backup.destination.allowDownload',
  'backup.destination.allowLocalDisk',
  'backup.destination.localSubpath',
  'backup.destination.allowExternalDisk',
  'backup.destination.allowNAS',
  'backup.destination.allowNetworkShare',
  'backup.destination.allowObjectStorage',
  'backup.destination.allowRemoteServer',
] as const;

export function isCompanyOnlySettingKey(key: string): boolean {
  return (COMPANY_ONLY_SETTING_KEYS as readonly string[]).includes(key);
}

/** Ops calculator unlock PIN (D162/D170). */
export const OPS_UNLOCK_CODE_KEY = 'ops.unlock_code';
export const OPS_UNLOCK_CODE_DEFAULT = '3141';

/** Ops visibility (D180/D203) — Prefs Admin · COMPANY_ONLY. */
export const OPS_VISIBILITY_SETTING_KEYS = {
  GHOST_HIDE_DELIVERY: 'ops.ghost.hide_delivery',
  PATCH_HIDE_DELIVERY: 'ops.patch.hide_delivery',
  PATCH_ACCOUNTING_PARTIAL: 'ops.patch.accounting_partial',
  GHOST_ACCOUNTING_PARTIAL: 'ops.ghost.accounting_partial',
  PATCH_ACCOUNTING_PRESET: 'ops.patch.accounting_preset',
  PATCH_ACCOUNTING_INTENSITY: 'ops.patch.accounting_intensity',
  PATCH_DISPLAY_RULES: 'ops.patch.display_rules',
  GHOST_HIDDEN_FEATURES: 'ops.ghost.hidden_features',
} as const;

export type OpsVisibilitySettingKey =
  (typeof OPS_VISIBILITY_SETTING_KEYS)[keyof typeof OPS_VISIBILITY_SETTING_KEYS];

export const OPS_VISIBILITY_DEFAULTS: Record<string, unknown> = {
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDE_DELIVERY]: true,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_HIDE_DELIVERY]: true,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PARTIAL]: true,
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_ACCOUNTING_PARTIAL]: false,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_PRESET]: 'partial',
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_ACCOUNTING_INTENSITY]: 30,
  [OPS_VISIBILITY_SETTING_KEYS.PATCH_DISPLAY_RULES]: ['by_date'],
  [OPS_VISIBILITY_SETTING_KEYS.GHOST_HIDDEN_FEATURES]: [],
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
    case SetLevel.SITE:
      return `site:${params.companyId}:${params.subjectId}`;
    case SetLevel.DOCUMENT:
      return `document:${params.companyId}:${params.subjectId}`;
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
    'ui.density': ['compact', 'comfortable', 'spacious'],
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
  'tax.ras',
  'tax.tej',
  'hr.cnss.employee',
  'hr.cnss.employer',
  'hr.cnss.ceiling',
  'hr.irpp',
  'hr.irpp.abat.chef',
  'hr.irpp.abat.enfant',
  'hr.tfp',
  'hr.foprolos',
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
      'Fonds de développement de la compétitivité — seed demo STUB_UNTIL_EXPERT (D272) jusqu’au comptable.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: null,
  },
  {
    key: 'tax.timbre',
    domain: 'tax',
    label: 'Timbre fiscal',
    description:
      'Droit de timbre — seed demo STUB_UNTIL_EXPERT (D272) jusqu’au comptable.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: null,
  },
  {
    key: 'tax.ras',
    domain: 'tax',
    label: 'RAS (retenue à la source)',
    description:
      'Taux retenue à la source (rateBps) — vide jusqu’à saisie expert. Jamais seedé. Consumers AP seulement si VALIDATED.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/finance/ap-bills',
  },
  {
    key: 'tax.tej',
    domain: 'tax',
    label: 'TEJ (déclaration fiscale)',
    description:
      'Params locaux STUB (D272) pour brouillon XML — transmission API toujours DISABLED.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/settings#expertise',
  },
  {
    key: 'hr.cnss.employee',
    domain: 'hr',
    label: 'CNSS salarié',
    description:
      'Taux part salarié — seed demo STUB_UNTIL_EXPERT (D272) jusqu’au comptable.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.cnss.employer',
    domain: 'hr',
    label: 'CNSS employeur',
    description:
      'Taux part employeur — seed demo STUB_UNTIL_EXPERT (D272) jusqu’au comptable.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.cnss.ceiling',
    domain: 'hr',
    label: 'CNSS plafond',
    description:
      'Plafond assiette — seed demo STUB_UNTIL_EXPERT (D272) jusqu’au comptable.',
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
    key: 'hr.irpp.abat.chef',
    domain: 'hr',
    label: 'IRPP abattement chef de famille',
    description:
      'Montant annuel (amountMilli) abattement chef de famille — vide jusqu’à expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.irpp.abat.enfant',
    domain: 'hr',
    label: 'IRPP abattement par enfant',
    description:
      'Montant annuel (amountMilli) par enfant à charge — vide jusqu’à expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.tfp',
    domain: 'hr',
    label: 'TFP',
    description:
      'Taxe de formation professionnelle — taux employeur (rateBps). Vide jusqu’à expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
  {
    key: 'hr.foprolos',
    domain: 'hr',
    label: 'FOPROLOS',
    description:
      'Fonds de promotion du logement social — taux employeur (rateBps). Vide jusqu’à expert. Jamais seedé.',
    defaultStatus: 'PENDING_EXPERT',
    lawRefHint: null,
    manageHref: '/hr',
  },
] as const;

/** Slots writable via Préférences (VAT remains Tax Engine only). */
export const EXPERTISE_WRITABLE_KEYS = [
  'tax.fodec',
  'tax.timbre',
  'tax.ras',
  'tax.tej',
  'hr.cnss.employee',
  'hr.cnss.employer',
  'hr.cnss.ceiling',
  'hr.irpp',
  'hr.irpp.abat.chef',
  'hr.irpp.abat.enfant',
  'hr.tfp',
  'hr.foprolos',
] as const;

export type ExpertiseWritableKey = (typeof EXPERTISE_WRITABLE_KEYS)[number];

export function isExpertiseWritableKey(
  key: string,
): key is ExpertiseWritableKey {
  return (EXPERTISE_WRITABLE_KEYS as readonly string[]).includes(key);
}

/** D304–D308 Backup module prefs — company-scoped. */
export const BACKUP_SETTING_KEYS = [
  'backup.enabled',
  'backup.defaultType',
  'backup.preActionSnapshot.enabled',
  'backup.destination.primary',
  'backup.restore.requireElevatedPermission',
  'backup.retention.enabled',
  'backup.retention.keepDays',
  'backup.retention.lockedNeverDelete',
  'backup.schedule.enabled',
  'backup.schedule.hourTunis',
  'backup.restore.safetyBackup.required',
  'backup.autoBackup.enabled',
  'backup.autoBackup.hourTunis',
  'backup.autoBackup.scope',
  'backup.specificFolders.enabled',
  'backup.specificFolders.defaultSelection',
  'backup.specificFolders.allowUserSelection',
  'backup.specificFolders.followSymlinks',
  'backup.specificFolders.includePatterns',
  'backup.specificFolders.excludePatterns',
  'backup.specificFolders.maxSize',
  'backup.specificFolders.verifyAfterBackup',
  'backup.specificFolders.auto.enabled',
  'backup.specificFolders.auto.hourTunis',
  'backup.destination.allowDownload',
  'backup.destination.allowLocalDisk',
  'backup.destination.localSubpath',
  'backup.destination.allowExternalDisk',
  'backup.destination.allowNAS',
  'backup.destination.allowNetworkShare',
  'backup.destination.allowObjectStorage',
  'backup.destination.allowRemoteServer',
] as const;

export type BackupSettingKey = (typeof BACKUP_SETTING_KEYS)[number];

export const BACKUP_SETTING_DEFAULTS: Record<BackupSettingKey, unknown> = {
  'backup.enabled': true,
  'backup.defaultType': 'FULL',
  'backup.preActionSnapshot.enabled': true,
  'backup.destination.primary': '',
  'backup.restore.requireElevatedPermission': true,
  'backup.retention.enabled': false,
  'backup.retention.keepDays': 30,
  'backup.retention.lockedNeverDelete': true,
  'backup.schedule.enabled': false,
  'backup.schedule.hourTunis': 3,
  'backup.restore.safetyBackup.required': true,
  'backup.autoBackup.enabled': false,
  'backup.autoBackup.hourTunis': 2,
  'backup.autoBackup.scope': 'DATABASE',
  'backup.specificFolders.enabled': false,
  'backup.specificFolders.defaultSelection': [],
  'backup.specificFolders.allowUserSelection': true,
  'backup.specificFolders.followSymlinks': false,
  'backup.specificFolders.includePatterns': [],
  'backup.specificFolders.excludePatterns': ['*.tmp', '*.cache', 'node_modules', 'temp', 'logs'],
  'backup.specificFolders.maxSize': 10_737_418_240,
  'backup.specificFolders.verifyAfterBackup': true,
  'backup.specificFolders.auto.enabled': false,
  'backup.specificFolders.auto.hourTunis': 23,
  'backup.destination.allowDownload': true,
  'backup.destination.allowLocalDisk': true,
  'backup.destination.localSubpath': '',
  'backup.destination.allowExternalDisk': false,
  'backup.destination.allowNAS': false,
  'backup.destination.allowNetworkShare': false,
  'backup.destination.allowObjectStorage': false,
  'backup.destination.allowRemoteServer': false,
};

export const BACKUP_SETTING_META: Record<
  BackupSettingKey,
  { valueType: string; description: string }
> = {
  'backup.enabled': {
    valueType: 'boolean',
    description: 'Enable Backup module operations (D304)',
  },
  'backup.defaultType': {
    valueType: 'string',
    description: 'Default backup type (FULL)',
  },
  'backup.preActionSnapshot.enabled': {
    valueType: 'boolean',
    description: 'Repair may request pre-action Backup create',
  },
  'backup.destination.primary': {
    valueType: 'string',
    description: 'Primary destination id reference (not a secret path)',
  },
  'backup.restore.requireElevatedPermission': {
    valueType: 'boolean',
    description: 'Restore requires elevated permission (D305+)',
  },
  'backup.retention.enabled': {
    valueType: 'boolean',
    description: 'Enable automatic retention purge (D306)',
  },
  'backup.retention.keepDays': {
    valueType: 'number',
    description: 'Keep unlocked backups for N days before soft-delete',
  },
  'backup.retention.lockedNeverDelete': {
    valueType: 'boolean',
    description: 'Locked backups are never auto-purged by retention',
  },
  'backup.schedule.enabled': {
    valueType: 'boolean',
    description: 'Enable Tunis-hour retention scheduler tick (D306)',
  },
  'backup.schedule.hourTunis': {
    valueType: 'number',
    description: 'Hour (0–23) Africa/Tunis to enqueue retention job',
  },
  'backup.restore.safetyBackup.required': {
    valueType: 'boolean',
    description: 'Create safety DATABASE backup before live restore apply (D307)',
  },
  'backup.autoBackup.enabled': {
    valueType: 'boolean',
    description: 'Enable Tunis-hour automatic backup create (D308)',
  },
  'backup.autoBackup.hourTunis': {
    valueType: 'number',
    description: 'Hour (0–23) Africa/Tunis to create scheduled backup',
  },
  'backup.autoBackup.scope': {
    valueType: 'enum',
    description: 'Scheduled backup scope: CONFIGURATION | DATABASE',
  },
  'backup.specificFolders.enabled': {
    valueType: 'boolean',
    description: 'Enable specific folder backup feature (D313)',
  },
  'backup.specificFolders.defaultSelection': {
    valueType: 'json',
    description: 'Default relative folder paths under company sandbox',
  },
  'backup.specificFolders.allowUserSelection': {
    valueType: 'boolean',
    description: 'Allow operators to pick folders beyond defaults',
  },
  'backup.specificFolders.followSymlinks': {
    valueType: 'boolean',
    description: 'Follow symlinks inside sandbox (default false — security)',
  },
  'backup.specificFolders.includePatterns': {
    valueType: 'json',
    description: 'Glob include patterns (empty = all)',
  },
  'backup.specificFolders.excludePatterns': {
    valueType: 'json',
    description: 'Glob exclude patterns',
  },
  'backup.specificFolders.maxSize': {
    valueType: 'number',
    description: 'Max uncompressed selection size in bytes',
  },
  'backup.specificFolders.verifyAfterBackup': {
    valueType: 'boolean',
    description: 'Verify ZIP checksum after create',
  },
  'backup.specificFolders.auto.enabled': {
    valueType: 'boolean',
    description: 'Enable Tunis-hour auto specific-folder backup',
  },
  'backup.specificFolders.auto.hourTunis': {
    valueType: 'number',
    description: 'Hour (0–23) Africa/Tunis for specific-folder auto backup',
  },
  'backup.destination.allowDownload': {
    valueType: 'boolean',
    description: 'Allow DOWNLOAD_EXPORT destination (D313)',
  },
  'backup.destination.allowLocalDisk': {
    valueType: 'boolean',
    description: 'Allow LOCAL_DISK destination (D313)',
  },
  'backup.destination.localSubpath': {
    valueType: 'string',
    description:
      'Relative subpath under data/backups/{companyId}/ for LOCAL_DISK artifacts (D314)',
  },
  'backup.destination.allowExternalDisk': {
    valueType: 'boolean',
    description: 'Allow EXTERNAL_DISK — unsupported until later lot',
  },
  'backup.destination.allowNAS': {
    valueType: 'boolean',
    description: 'Allow NAS — unsupported until later lot',
  },
  'backup.destination.allowNetworkShare': {
    valueType: 'boolean',
    description: 'Allow NETWORK_SHARE — unsupported until later lot',
  },
  'backup.destination.allowObjectStorage': {
    valueType: 'boolean',
    description: 'Allow OBJECT_STORAGE — unsupported until later lot',
  },
  'backup.destination.allowRemoteServer': {
    valueType: 'boolean',
    description: 'Allow REMOTE_SERVER — unsupported until later lot',
  },
};

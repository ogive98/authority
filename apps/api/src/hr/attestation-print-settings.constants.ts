/**
 * HR attestation print template Prefs (D217) — structural skeleton defaults.
 * Never seed Tunisian legal attestation formulas.
 */

import { ATTESTATION_BODY_SKELETON } from './hr-print-merge';

export const ATTESTATION_PRINT_SETTING_KEYS = {
  LETTERHEAD: 'hr.attestation.letterhead',
  BODY_HTML: 'hr.attestation.body_html',
  FOOTER: 'hr.attestation.footer',
} as const;

export type AttestationPrintSettingKey =
  (typeof ATTESTATION_PRINT_SETTING_KEYS)[keyof typeof ATTESTATION_PRINT_SETTING_KEYS];

export const ATTESTATION_PRINT_SETTING_DEFAULTS: Record<
  AttestationPrintSettingKey,
  string
> = {
  [ATTESTATION_PRINT_SETTING_KEYS.LETTERHEAD]: '',
  [ATTESTATION_PRINT_SETTING_KEYS.BODY_HTML]: ATTESTATION_BODY_SKELETON,
  [ATTESTATION_PRINT_SETTING_KEYS.FOOTER]: '',
};

export const ATTESTATION_PRINT_SETTING_META: Record<
  AttestationPrintSettingKey,
  string
> = {
  [ATTESTATION_PRINT_SETTING_KEYS.LETTERHEAD]:
    'Attestation PDF letterhead — empty until human. No legal seed.',
  [ATTESTATION_PRINT_SETTING_KEYS.BODY_HTML]:
    'Attestation PDF body HTML — structural skeleton; placeholders {{employeeName}} {{matricule}} {{cinNo}} {{cnssNo}} {{address}} {{jobTitle}} {{department}} {{contractNumber}} {{contractType}} {{startDate}} {{hiredAt}} {{companyName}}.',
  [ATTESTATION_PRINT_SETTING_KEYS.FOOTER]:
    'Attestation PDF footer — empty until human.',
};

export type AttestationPrintTemplate = {
  letterhead: string;
  bodyHtml: string;
  footer: string;
};

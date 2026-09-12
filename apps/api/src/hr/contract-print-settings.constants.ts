/**
 * HR contract print template Prefs (D216/D217) — structural skeleton defaults.
 * Never seed Tunisian legal clauses / CDI boilerplate.
 */

import { CONTRACT_BODY_SKELETON } from './hr-print-merge';

export const CONTRACT_PRINT_SETTING_KEYS = {
  LETTERHEAD: 'hr.contract.letterhead',
  BODY_HTML: 'hr.contract.body_html',
  FOOTER: 'hr.contract.footer',
} as const;

export type ContractPrintSettingKey =
  (typeof CONTRACT_PRINT_SETTING_KEYS)[keyof typeof CONTRACT_PRINT_SETTING_KEYS];

export const CONTRACT_PRINT_SETTING_DEFAULTS: Record<
  ContractPrintSettingKey,
  string
> = {
  [CONTRACT_PRINT_SETTING_KEYS.LETTERHEAD]: '',
  [CONTRACT_PRINT_SETTING_KEYS.BODY_HTML]: CONTRACT_BODY_SKELETON,
  [CONTRACT_PRINT_SETTING_KEYS.FOOTER]: '',
};

export const CONTRACT_PRINT_SETTING_META: Record<
  ContractPrintSettingKey,
  string
> = {
  [CONTRACT_PRINT_SETTING_KEYS.LETTERHEAD]:
    'Contract PDF letterhead (company block) — empty until human. No legal seed.',
  [CONTRACT_PRINT_SETTING_KEYS.BODY_HTML]:
    'Contract PDF body HTML — structural skeleton + human clauses; placeholders {{employeeName}} {{matricule}} {{cinNo}} {{cnssNo}} {{address}} {{bankName}} {{bankAgency}} {{bankAccount}} {{contractNumber}} {{contractType}} {{startDate}} {{endDate}} {{wageRef}} {{wageBase}} {{companyName}} {{notes}}.',
  [CONTRACT_PRINT_SETTING_KEYS.FOOTER]:
    'Contract PDF footer — empty until human. No invented legal footer.',
};

export type ContractPrintTemplate = {
  letterhead: string;
  bodyHtml: string;
  footer: string;
};

/** Future custom-field foundation — contracts only in Phase 1. */

export const FORGE_CUSTOM_FIELD_TYPES = [
  'STRING',
  'NUMBER',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'SELECT',
  'MULTI_SELECT',
  'REFERENCE',
  'JSON',
] as const;

export type ForgeCustomFieldType =
  (typeof FORGE_CUSTOM_FIELD_TYPES)[number];

export type CustomFieldDefinition = {
  key: string;
  entityType: string;
  fieldType: ForgeCustomFieldType;
  label?: Record<string, string>;
  required?: boolean;
  options?: string[];
  referenceEntity?: string;
};

export type CustomFieldValue = {
  fieldKey: string;
  entityType: string;
  entityId: string;
  valueJson: unknown;
};

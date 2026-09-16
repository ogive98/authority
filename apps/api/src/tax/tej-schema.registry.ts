/**
 * D293 — TEJ local schema registry (swap-ready).
 * Never invents official TEJ XSD content. Transmission always DISABLED.
 * When MF provides a validated XSD file, register it here and point activeId —
 * pack builders swap without rewrite.
 */

export type TejSchemaKind = 'LOCAL_DRAFT' | 'OFFICIAL_XSD';

export type TejSchemaEntry = {
  id: string;
  kind: TejSchemaKind;
  /** Human Soft Glass badge. */
  label: string;
  note: string;
  /** Absolute or repo-relative path — null until official artefact lands. */
  xsdPath: string | null;
  transmissionAllowed: false;
};

export const TEJ_SCHEMA_REGISTRY: readonly TejSchemaEntry[] = [
  {
    id: 'AUTHORITY_LOCAL_DRAFT@1',
    kind: 'LOCAL_DRAFT',
    label: 'AUTHORITY_LOCAL_DRAFT · v1',
    note: 'Local draft only — not an official TEJ XSD; awaiting validated schema; transmission DISABLED',
    xsdPath: null,
    transmissionAllowed: false,
  },
] as const;

/** Active pack schema — flip when official XSD is registered + validated. */
export const TEJ_ACTIVE_SCHEMA_ID = 'AUTHORITY_LOCAL_DRAFT@1' as const;

export function getActiveTejSchema(): TejSchemaEntry {
  const entry = TEJ_SCHEMA_REGISTRY.find((e) => e.id === TEJ_ACTIVE_SCHEMA_ID);
  if (!entry) {
    return TEJ_SCHEMA_REGISTRY[0]!;
  }
  return entry;
}

export function listTejSchemas(): readonly TejSchemaEntry[] {
  return TEJ_SCHEMA_REGISTRY;
}

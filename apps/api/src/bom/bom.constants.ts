export const BOM_ERROR_CODES = {
  NOT_FOUND: 'BOM.NOT_FOUND',
  ALREADY_ACTIVE: 'BOM.ALREADY_ACTIVE',
  INVALID_VERSION: 'BOM.INVALID_VERSION',
  CONTEXT_FORBIDDEN: 'BOM.CONTEXT_FORBIDDEN',
} as const;

export const PERMISSION_KEYS = {
  bomRead: 'bom.read',
  bomWrite: 'bom.write',
  bomActivate: 'bom.activate',
} as const;

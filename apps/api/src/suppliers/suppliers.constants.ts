export const SUPPLIERS_ERROR_CODES = {
  NOT_FOUND: 'SUP.NOT_FOUND',
  CODE_DUP: 'SUP.CODE_DUP',
  PARTY_DUP: 'SUP.PARTY_DUP',
  VERSION_CONFLICT: 'SUP.VERSION_CONFLICT',
  PARTY_NOT_FOUND: 'SUP.PARTY_NOT_FOUND',
  CONTACT_NOT_FOUND: 'SUP.CONTACT_NOT_FOUND',
  INVALID_STATUS: 'SUP.INVALID_STATUS',
  INVALID_CATEGORY: 'SUP.INVALID_CATEGORY',
  INVALID_LEAD_TIME: 'SUP.INVALID_LEAD_TIME',
  INVALID_MOQ: 'SUP.INVALID_MOQ',
} as const;

export type SuppliersErrorCode =
  (typeof SUPPLIERS_ERROR_CODES)[keyof typeof SUPPLIERS_ERROR_CODES];

export const SUPPLIER_CATEGORIES = [
  'LAIT',
  'EMBALLAGE',
  'FOURNITURE',
  'IMPORT',
] as const;

export type SupplierCategory = (typeof SUPPLIER_CATEGORIES)[number];

export const SUPPLIER_STATUSES = [
  'ACTIVE',
  'ON_HOLD',
  'BLOCKED',
  'ARCHIVED',
] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

export const SUPPLIERS_EVENT_TYPES = {
  SUPPLIER_CREATED: 'suppliers.supplier.created.v1',
  SUPPLIER_UPDATED: 'suppliers.supplier.updated.v1',
  SUPPLIER_HOLD: 'suppliers.supplier.hold.v1',
} as const;

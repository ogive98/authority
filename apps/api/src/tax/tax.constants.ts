export const TAX_ERROR_CODES = {
  NOT_FOUND: 'TAX.NOT_FOUND',
  CODE_NOT_FOUND: 'TAX.CODE_NOT_FOUND',
  RATE_NOT_FOUND: 'TAX.RATE_NOT_FOUND',
  INVALID_RATE: 'TAX.INVALID_RATE',
  INVALID_STATUS: 'TAX.INVALID_STATUS',
} as const;

export type TaxErrorCode =
  (typeof TAX_ERROR_CODES)[keyof typeof TAX_ERROR_CODES];

export const TAX_EVENT_TYPES = {
  RATE_PUBLISHED: 'tax.rate.published.v1',
} as const;

export const TAX_LAW_REF_TN =
  'Code TVA art.7 / LF2018 art.43 (taux 7/13/19)';

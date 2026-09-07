export const ACCOUNTING_ERROR_CODES = {
  NOT_FOUND: 'ACC.NOT_FOUND',
  ACCOUNT_NOT_FOUND: 'ACC.ACCOUNT_NOT_FOUND',
  JOURNAL_NOT_FOUND: 'ACC.JOURNAL_NOT_FOUND',
  PERIOD_NOT_FOUND: 'ACC.PERIOD_NOT_FOUND',
  YEAR_NOT_FOUND: 'ACC.YEAR_NOT_FOUND',
  ENTRY_NOT_FOUND: 'ACC.ENTRY_NOT_FOUND',
  INVALID_STATUS: 'ACC.INVALID_STATUS',
  PERIOD_CLOSED: 'ACC.PERIOD_CLOSED',
  UNBALANCED: 'ACC.UNBALANCED',
  INVALID_LINE: 'ACC.INVALID_LINE',
  DUPLICATE_CODE: 'ACC.DUPLICATE_CODE',
  IMMUTABLE: 'ACC.IMMUTABLE',
  ACCOUNT_INACTIVE: 'ACC.ACCOUNT_INACTIVE',
} as const;

export type AccountingErrorCode =
  (typeof ACCOUNTING_ERROR_CODES)[keyof typeof ACCOUNTING_ERROR_CODES];

export const ACCOUNTING_EVENT_TYPES = {
  ACCOUNT_CREATED: 'accounting.account.created.v1',
  ENTRY_POSTED: 'accounting.entry.posted.v1',
} as const;

/** Seed / posting defaults — codes are data, not invented tax rates. */
export const DEFAULT_GL_CODES = {
  ar: '411',
  bank: '512',
  revenue: '701',
  salesJournal: 'VEN',
  bankJournal: 'BQ',
} as const;

export const FINANCE_ERROR_CODES = {
  NOT_FOUND: 'FIN.NOT_FOUND',
  CUSTOMER_NOT_FOUND: 'FIN.CUSTOMER_NOT_FOUND',
  INVALID_AMOUNT: 'FIN.INVALID_AMOUNT',
  INVALID_STATUS: 'FIN.INVALID_STATUS',
  OVER_ALLOCATE: 'FIN.OVER_ALLOCATE',
  ORDER_NOT_FOUND: 'FIN.ORDER_NOT_FOUND',
  INVOICE_NOT_FOUND: 'FIN.INVOICE_NOT_FOUND',
  PAYMENT_NOT_FOUND: 'FIN.PAYMENT_NOT_FOUND',
  INSTRUMENT_NOT_FOUND: 'FIN.INSTRUMENT_NOT_FOUND',
  INVALID_POLICY: 'FIN.INVALID_POLICY',
  INSTRUMENT_REQUIRED: 'FIN.INSTRUMENT_REQUIRED',
  ALREADY_ALLOCATED: 'FIN.ALREADY_ALLOCATED',
  PROMISE_EXISTS: 'FIN.PROMISE_EXISTS',
  PROMISE_NOT_FOUND: 'FIN.PROMISE_NOT_FOUND',
  BANK_ACCOUNT_NOT_FOUND: 'FIN.BANK_ACCOUNT_NOT_FOUND',
  BANK_LINE_NOT_FOUND: 'FIN.BANK_LINE_NOT_FOUND',
  BANK_ALREADY_MATCHED: 'FIN.BANK_ALREADY_MATCHED',
  BANK_MATCH_TARGET: 'FIN.BANK_MATCH_TARGET',
  BANK_AMOUNT_MISMATCH: 'FIN.BANK_AMOUNT_MISMATCH',
  DUNNING_NOT_ELIGIBLE: 'FIN.DUNNING_NOT_ELIGIBLE',
  DUNNING_PROMISE_OPEN: 'FIN.DUNNING_PROMISE_OPEN',
  DUNNING_NOT_FOUND: 'FIN.DUNNING_NOT_FOUND',
  DUNNING_CONTACT: 'FIN.DUNNING_CONTACT',
  DUNNING_EXISTS: 'FIN.DUNNING_EXISTS',
} as const;

export type FinanceErrorCode =
  (typeof FINANCE_ERROR_CODES)[keyof typeof FINANCE_ERROR_CODES];

export const FINANCE_EVENT_TYPES = {
  OPEN_ITEM_CREATED: 'finance.open_item.created.v1',
  ALLOCATION_RECORDED: 'finance.allocation.recorded.v1',
  INVOICE_ISSUED: 'finance.invoice.issued.v1',
  INVOICE_CANCELLED: 'finance.invoice.cancelled.v1',
  PAYMENT_POSTED: 'finance.payment.posted.v1',
  PAYMENT_ALLOCATED: 'finance.payment.allocated.v1',
  PAYMENT_REVERSED: 'finance.payment.reversed.v1',
  INSTRUMENT_STATUS: 'finance.instrument.status.v1',
  INSTRUMENT_REJECTED: 'finance.instrument.rejected.v1',
  PROMISE_CREATED: 'finance.promise.created.v1',
  PROMISE_STATUS: 'finance.promise.status.v1',
  BANK_MATCHED: 'finance.bank.matched.v1',
  BANK_UNMATCHED: 'finance.bank.unmatched.v1',
  DUNNING_PREPARED: 'finance.dunning.prepared.v1',
  DUNNING_CONFIRMED: 'finance.dunning.confirmed.v1',
} as const;

/** Company settings — credit exposure check on sales confirm (default off). */
export const FINANCE_SETTING_KEYS = {
  CREDIT_ENFORCE: 'finance.credit.enforce',
  /** Days past due milestones for FIN-INTEL collections (D182). */
  COLLECTION_REMIND_DAYS: 'finance.collection.remind_days',
  /** Warn ratio outstanding/limit for FIN-INTEL credit pressure (D185). */
  CREDIT_WARN_RATIO: 'finance.credit.warn_ratio',
} as const;

export const FINANCE_SETTING_DEFAULTS = {
  [FINANCE_SETTING_KEYS.CREDIT_ENFORCE]: false,
  /** Empty = binary overdue; product default milestones when seeded. */
  [FINANCE_SETTING_KEYS.COLLECTION_REMIND_DAYS]: [1, 7, 15, 30],
  [FINANCE_SETTING_KEYS.CREDIT_WARN_RATIO]: 0.8,
} as const;

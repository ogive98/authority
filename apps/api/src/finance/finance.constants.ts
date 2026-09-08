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
} as const;

export type FinanceErrorCode =
  (typeof FINANCE_ERROR_CODES)[keyof typeof FINANCE_ERROR_CODES];

export const FINANCE_EVENT_TYPES = {
  OPEN_ITEM_CREATED: 'finance.open_item.created.v1',
  ALLOCATION_RECORDED: 'finance.allocation.recorded.v1',
  INVOICE_ISSUED: 'finance.invoice.issued.v1',
  PAYMENT_POSTED: 'finance.payment.posted.v1',
  PAYMENT_ALLOCATED: 'finance.payment.allocated.v1',
  INSTRUMENT_STATUS: 'finance.instrument.status.v1',
  INSTRUMENT_REJECTED: 'finance.instrument.rejected.v1',
  PROMISE_CREATED: 'finance.promise.created.v1',
  PROMISE_STATUS: 'finance.promise.status.v1',
} as const;

/** Company settings — credit exposure check on sales confirm (default off). */
export const FINANCE_SETTING_KEYS = {
  CREDIT_ENFORCE: 'finance.credit.enforce',
} as const;

export const FINANCE_SETTING_DEFAULTS = {
  [FINANCE_SETTING_KEYS.CREDIT_ENFORCE]: false,
} as const;

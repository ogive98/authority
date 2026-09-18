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
  BANK_CSV_INVALID: 'FIN.BANK_CSV_INVALID',
  BANK_OFX_INVALID: 'FIN.BANK_OFX_INVALID',
  BANK_FEE_NOT_ELIGIBLE: 'FIN.BANK_FEE_NOT_ELIGIBLE',
  BANK_FEE_GL_MISSING: 'FIN.BANK_FEE_GL_MISSING',
  BANK_FEE_ALREADY_POSTED: 'FIN.BANK_FEE_ALREADY_POSTED',
  BANK_MATCH_SIDE: 'FIN.BANK_MATCH_SIDE',
  AP_PAYMENT_NOT_FOUND: 'FIN.AP_PAYMENT_NOT_FOUND',
  AP_BILL_NOT_FOUND: 'FIN.AP_BILL_NOT_FOUND',
  DUNNING_NOT_ELIGIBLE: 'FIN.DUNNING_NOT_ELIGIBLE',
  DUNNING_PROMISE_OPEN: 'FIN.DUNNING_PROMISE_OPEN',
  DUNNING_NOT_FOUND: 'FIN.DUNNING_NOT_FOUND',
  DUNNING_CONTACT: 'FIN.DUNNING_CONTACT',
  DUNNING_EXISTS: 'FIN.DUNNING_EXISTS',
  DUNNING_NOT_CONFIRMED: 'FIN.DUNNING_NOT_CONFIRMED',
  DUNNING_CHANNEL_NOT_CONFIGURED: 'FIN.DUNNING_CHANNEL_NOT_CONFIGURED',
  DUNNING_ALREADY_SENT: 'FIN.DUNNING_ALREADY_SENT',
  CREDIT_NOTE_NOT_FOUND: 'FIN.CREDIT_NOTE_NOT_FOUND',
  CREDIT_NOTE_OVER_CAP: 'FIN.CREDIT_NOTE_OVER_CAP',
} as const;

export type FinanceErrorCode =
  (typeof FINANCE_ERROR_CODES)[keyof typeof FINANCE_ERROR_CODES];

export const FINANCE_EVENT_TYPES = {
  OPEN_ITEM_CREATED: 'finance.open_item.created.v1',
  ALLOCATION_RECORDED: 'finance.allocation.recorded.v1',
  INVOICE_ISSUED: 'finance.invoice.issued.v1',
  INVOICE_CANCELLED: 'finance.invoice.cancelled.v1',
  CREDIT_NOTE_ISSUED: 'finance.credit_note.issued.v1',
  PAYMENT_POSTED: 'finance.payment.posted.v1',
  PAYMENT_ALLOCATED: 'finance.payment.allocated.v1',
  PAYMENT_REVERSED: 'finance.payment.reversed.v1',
  INSTRUMENT_STATUS: 'finance.instrument.status.v1',
  INSTRUMENT_REJECTED: 'finance.instrument.rejected.v1',
  PROMISE_CREATED: 'finance.promise.created.v1',
  PROMISE_STATUS: 'finance.promise.status.v1',
  BANK_MATCHED: 'finance.bank.matched.v1',
  BANK_UNMATCHED: 'finance.bank.unmatched.v1',
  BANK_IGNORED: 'finance.bank.ignored.v1',
  BANK_UNIGNORED: 'finance.bank.unignored.v1',
  BANK_FEE_POSTED: 'finance.bank.fee_posted.v1',
  AP_PAYMENT_POSTED: 'finance.ap_payment.posted.v1',
  AP_BILL_CREATED: 'finance.ap_bill.created.v1',
  AP_BILL_POSTED: 'finance.ap_bill.posted.v1',
  AP_BILL_CANCELLED: 'finance.ap_bill.cancelled.v1',
  DUNNING_PREPARED: 'finance.dunning.prepared.v1',
  DUNNING_CONFIRMED: 'finance.dunning.confirmed.v1',
  DUNNING_SENT: 'finance.dunning.sent.v1',
  DUNNING_SEND_FAILED: 'finance.dunning.send_failed.v1',
  DUNNING_WA_STATUS: 'finance.dunning.wa_status.v1',
  INVOICE_PDF_GENERATED: 'finance.invoice.pdf_generated.v1',
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

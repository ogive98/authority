export const TAX_ERROR_CODES = {
  NOT_FOUND: 'TAX.NOT_FOUND',
  CODE_NOT_FOUND: 'TAX.CODE_NOT_FOUND',
  RATE_NOT_FOUND: 'TAX.RATE_NOT_FOUND',
  INVALID_RATE: 'TAX.INVALID_RATE',
  INVALID_STATUS: 'TAX.INVALID_STATUS',
  INVALID_INPUT: 'TAX.INVALID_INPUT',
} as const;

export type TaxErrorCode =
  (typeof TAX_ERROR_CODES)[keyof typeof TAX_ERROR_CODES];

export const TAX_EVENT_TYPES = {
  /** Canonical runtime event (D088). */
  RATE_PUBLISHED: 'tax.rate.published.v1',
  /** CDC alias — emitted alongside RATE_PUBLISHED on create/patch. */
  RATE_CHANGED: 'tax.rate.changed.v1',
  /** D265 — local TEJ draft generated (hash history; never transmitted). */
  TEJ_LOCAL_GENERATED: 'tax.tej.local_generated.v1',
  /** D282 — RAS withholding created / validated. */
  WITHHOLDING_CREATED: 'tax.withholding.created.v1',
  WITHHOLDING_VALIDATED: 'tax.withholding.validated.v1',
  /** D283 — withholding auto-created from AP disbursement. */
  WITHHOLDING_FROM_AP: 'tax.withholding.from_ap.v1',
  /** D284 — local RAS certificate generated (not official MF). */
  WITHHOLDING_CERTIFICATE: 'tax.withholding.certificate.v1',
} as const;

export const TAX_LAW_REF_TN =
  'Code TVA art.7 / LF2018 art.43 (taux 7/13/19)';

export const TAX_DECISION_REASONS = {
  APPLIED_RATE: 'APPLIED_RATE',
  APPLIED_QTY: 'APPLIED_QTY',
  APPLIED_FIXED: 'APPLIED_FIXED',
  PENDING_EXPERT: 'PENDING_EXPERT',
  NOT_ACTIVE: 'NOT_ACTIVE',
  INACTIVE: 'INACTIVE',
  AMOUNT_NOT_VALIDATED: 'AMOUNT_NOT_VALIDATED',
  RATE_NOT_FOUND: 'RATE_NOT_FOUND',
  NO_TAX_CODE: 'NO_TAX_CODE',
  EXEMPTION: 'EXEMPTION',
} as const;

export type TaxDecisionReason =
  (typeof TAX_DECISION_REASONS)[keyof typeof TAX_DECISION_REASONS];

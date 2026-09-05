export const CUSTOMER_PORTAL_COOKIE_NAME = 'authority_customer_portal_session';

export const CUSTOMER_PORTAL_DEFAULTS = {
  /** Session TTL ~8 hours */
  sessionTtlHours: 8,
} as const;

export const CUSTOMER_PORTAL_ERROR_CODES = {
  UNAUTHORIZED: 'POR.UNAUTHORIZED',
  FORBIDDEN: 'POR.FORBIDDEN',
  MEMBERSHIP_REQUIRED: 'POR.MEMBERSHIP_REQUIRED',
  NOT_FOUND: 'POR.NOT_FOUND',
  /** No prior unit price for this customer+product (no price list module yet). */
  PRICE_UNAVAILABLE: 'POR.PRICE_UNAVAILABLE',
  /** No active warehouse for company — cannot create Sales draft. */
  WAREHOUSE_UNAVAILABLE: 'POR.WAREHOUSE_UNAVAILABLE',
  VALIDATION: 'POR.VALIDATION',
} as const;

export type CustomerPortalErrorCode =
  (typeof CUSTOMER_PORTAL_ERROR_CODES)[keyof typeof CUSTOMER_PORTAL_ERROR_CODES];

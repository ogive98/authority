export const SALES_ERROR_CODES = {
  NOT_FOUND: 'SAL.NOT_FOUND',
  INVALID_STATUS: 'SAL.INVALID_STATUS',
  VERSION_CONFLICT: 'SAL.VERSION_CONFLICT',
  CUSTOMER_BLOCKED: 'SAL.CUSTOMER_BLOCKED',
  CUSTOMER_NOT_FOUND: 'SAL.CUSTOMER_NOT_FOUND',
  PRODUCT_NOT_FOUND: 'SAL.PRODUCT_NOT_FOUND',
  WAREHOUSE_NOT_FOUND: 'SAL.WAREHOUSE_NOT_FOUND',
  EMPTY_LINES: 'SAL.EMPTY_LINES',
  INVALID_LINE: 'SAL.INVALID_LINE',
  STOCK_RESERVE_FAILED: 'SAL.STOCK_RESERVE_FAILED',
  CREDIT_DENIED: 'SAL.CREDIT_DENIED',
} as const;

export type SalesErrorCode =
  (typeof SALES_ERROR_CODES)[keyof typeof SALES_ERROR_CODES];

export const SALES_EVENT_TYPES = {
  CREATED: 'sales.order.created.v1',
  CONFIRMED: 'sales.order.confirmed.v1',
  CANCELLED: 'sales.order.cancelled.v1',
} as const;

export const SALES_RESERVE_REF_TYPE = 'sales.order';

/** Company settings (docs SETTINGS.md + intake V0.1). */
export const SALES_SETTING_KEYS = {
  RESERVE_ON_CONFIRM: 'sales.reserve_on_confirm',
  AUTO_CONFIRM_ON_CREATE: 'sales.auto_confirm_on_create',
  REQUIRE_REQUESTED_DATE: 'sales.require_requested_date',
  ALLOW_MANUAL_PRICE: 'sales.allow_manual_price',
  DEFAULT_CURRENCY: 'sales.default_currency',
} as const;

export const SALES_SETTING_DEFAULTS = {
  [SALES_SETTING_KEYS.RESERVE_ON_CONFIRM]: true,
  [SALES_SETTING_KEYS.AUTO_CONFIRM_ON_CREATE]: false,
  [SALES_SETTING_KEYS.REQUIRE_REQUESTED_DATE]: false,
  [SALES_SETTING_KEYS.ALLOW_MANUAL_PRICE]: true,
  [SALES_SETTING_KEYS.DEFAULT_CURRENCY]: 'TND',
} as const;

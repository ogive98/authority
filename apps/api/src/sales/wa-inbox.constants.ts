export const WA_INBOX_ERROR_CODES = {
  NOT_FOUND: 'SAL.WA_INBOX_NOT_FOUND',
  INVALID_STATUS: 'SAL.WA_INBOX_INVALID_STATUS',
  CUSTOMER_REQUIRED: 'SAL.WA_INBOX_CUSTOMER_REQUIRED',
  VERSION_CONFLICT: 'SAL.WA_INBOX_VERSION_CONFLICT',
  CUSTOMER_NOT_FOUND: 'SAL.WA_INBOX_CUSTOMER_NOT_FOUND',
} as const;

export type WaInboxErrorCode =
  (typeof WA_INBOX_ERROR_CODES)[keyof typeof WA_INBOX_ERROR_CODES];

export const WA_INBOX_STATUSES = [
  'OPEN',
  'MATCHED',
  'DRAFT_CREATED',
  'DISMISSED',
] as const;

export type WaInboxStatus = (typeof WA_INBOX_STATUSES)[number];

export const WA_INBOX_EVENT_TYPES = {
  MATCHED: 'sales.wa_inbox.matched.v1',
  DISMISSED: 'sales.wa_inbox.dismissed.v1',
  DRAFT_CREATED: 'sales.wa_inbox.draft_created.v1',
} as const;

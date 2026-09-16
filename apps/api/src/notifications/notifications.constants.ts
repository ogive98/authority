export const NOTIFICATION_SOURCES = [
  'CREDIT_BREACH',
  'PROMISE_OVERDUE',
  'PORTAL_PAYMENT_DECL',
  'DUNNING_READY',
  'RAS_PENDING',
  'TEJ_PENDING',
  'ATM_REVIEW',
  'WA_INBOX',
  'PROD_NEED',
] as const;

export type NotificationSource = (typeof NOTIFICATION_SOURCES)[number];

export const NOTIFICATION_TYPES = [
  'success',
  'info',
  'warning',
  'danger',
  'task',
  'system',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_PRIORITIES = ['p0', 'p1', 'p2', 'p3'] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

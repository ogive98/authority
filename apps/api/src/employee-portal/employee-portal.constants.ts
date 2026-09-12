export const EMPLOYEE_PORTAL_COOKIE_NAME =
  'authority_employee_portal_session';

export const EMPLOYEE_PORTAL_DEFAULTS = {
  /** Session TTL ~8 hours */
  sessionTtlHours: 8,
} as const;

export const EMPLOYEE_PORTAL_ERROR_CODES = {
  UNAUTHORIZED: 'EPR.UNAUTHORIZED',
  FORBIDDEN: 'EPR.FORBIDDEN',
  EMPLOYEE_REQUIRED: 'EPR.EMPLOYEE_REQUIRED',
  NOT_FOUND: 'EPR.NOT_FOUND',
  VALIDATION: 'EPR.VALIDATION',
} as const;

export type EmployeePortalErrorCode =
  (typeof EMPLOYEE_PORTAL_ERROR_CODES)[keyof typeof EMPLOYEE_PORTAL_ERROR_CODES];

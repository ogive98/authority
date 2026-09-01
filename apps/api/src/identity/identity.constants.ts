export const IDENTITY_COOKIE_NAME = 'authority_business_session';

export const IDENTITY_DEFAULTS = {
  lockoutThreshold: 5,
  lockoutWindowMinutes: 15,
  sessionTtlHours: 24,
  passwordMinLength: 8,
} as const;

export const IDENTITY_ERROR_CODES = {
  INVALID_CREDENTIALS: 'IAM.INVALID_CREDENTIALS',
  LOCKED: 'IAM.LOCKED',
  ENV_MISMATCH: 'IAM.ENV_MISMATCH',
  MFA_REQUIRED: 'IAM.MFA_REQUIRED',
  UNAUTHORIZED: 'IAM.UNAUTHORIZED',
  SESSION_NOT_FOUND: 'IAM.SESSION_NOT_FOUND',
  FORBIDDEN: 'IAM.FORBIDDEN',
} as const;

export type IdentityErrorCode =
  (typeof IDENTITY_ERROR_CODES)[keyof typeof IDENTITY_ERROR_CODES];

export function getAuthorityEnv(): string {
  return process.env.AUTHORITY_ENV ?? process.env.NODE_ENV ?? 'development';
}

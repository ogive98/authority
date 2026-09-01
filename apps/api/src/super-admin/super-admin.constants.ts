export const SUPER_ADMIN_COOKIE_NAME = 'authority_super_admin_session';

export const SUPER_ADMIN_DEFAULTS = {
  sessionTtlMinutes: 15,
  mfaChallengeTtlMinutes: 5,
} as const;

export const SUPER_ADMIN_ERROR_CODES = {
  UNAUTHORIZED: 'SA.UNAUTHORIZED',
  MFA_NOT_ENROLLED: 'SA.MFA_NOT_ENROLLED',
  MFA_INVALID: 'SA.MFA_INVALID',
} as const;

export type SuperAdminErrorCode =
  (typeof SUPER_ADMIN_ERROR_CODES)[keyof typeof SUPER_ADMIN_ERROR_CODES];

/** Production always enforces TOTP. Non-prod only if AUTHORITY_SUPER_ADMIN_MFA_ENFORCED=true. */
export function isSuperAdminMfaEnforced(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  return process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED === 'true';
}

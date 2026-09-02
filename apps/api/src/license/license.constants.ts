export const LICENSE_ERROR_CODES = {
  INVALID: 'LIC.INVALID',
  EXPIRED: 'LIC.EXPIRED',
  TAMPER: 'LIC.TAMPER',
  LIMIT_SITES: 'LIC.LIMIT_SITES',
  LIMIT_USERS: 'LIC.LIMIT_USERS',
  NOT_CONFIGURED: 'LIC.NOT_CONFIGURED',
} as const;

export type LicenseErrorCode =
  (typeof LICENSE_ERROR_CODES)[keyof typeof LICENSE_ERROR_CODES];

export const LICENSE_STATUSES = {
  active: 'active',
  grace: 'grace',
  expired: 'expired',
} as const;

export type LicenseStatus =
  (typeof LICENSE_STATUSES)[keyof typeof LICENSE_STATUSES];

export const LICENSE_CACHE_KEY = 'authority:license:verified';

export const DEFAULT_LICENSE_CACHE_TTL_SECONDS = 300;

export interface LicensePayload {
  plan: string;
  maxSites: number;
  maxUsers: number;
  expiresAt: string;
  issuedAt: string;
}

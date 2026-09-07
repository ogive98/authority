export type EntitlementSource = 'license-stub' | 'control';

export type EntitlementStatus =
  | 'active'
  | 'grace'
  | 'expired'
  | 'missing'
  | 'invalid';

/**
 * Snapshot Control will eventually push/sign.
 * Stub fills from local LicenseService until CTRL-01.
 */
export type EntitlementSnapshot = {
  companyId: string | null;
  plan: string;
  status: EntitlementStatus;
  /** `*` = all catalogued modules allowed when status active|grace */
  allowedModuleKeys: string[] | '*';
  allowedCapabilityKeys: string[] | '*';
  source: EntitlementSource;
  expiresAt: string | null;
  denyModuleKeys: string[];
};

export type EntitlementDecision = {
  allowed: boolean;
  reason?: string;
  code?: string;
  snapshot: EntitlementSnapshot;
};

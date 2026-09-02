import { createHmac, timingSafeEqual } from 'node:crypto';
import type { LicensePayload } from './license.constants';

const PAYLOAD_FIELD_ORDER: (keyof LicensePayload)[] = [
  'plan',
  'maxSites',
  'maxUsers',
  'expiresAt',
  'issuedAt',
];

export function canonicalLicensePayload(payload: LicensePayload): string {
  const ordered: Record<string, unknown> = {};
  for (const key of PAYLOAD_FIELD_ORDER) {
    ordered[key] = payload[key];
  }
  return JSON.stringify(ordered);
}

export function signLicensePayload(
  payload: LicensePayload,
  signingKey?: string,
): string {
  const key = resolveSigningKey(signingKey);
  return createHmac('sha256', key)
    .update(canonicalLicensePayload(payload))
    .digest('hex');
}

export function verifyLicensePayload(
  payload: LicensePayload,
  signature: string,
  signingKey?: string,
): boolean {
  const key = resolveSigningKey(signingKey);
  const expected = createHmac('sha256', key)
    .update(canonicalLicensePayload(payload))
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

function resolveSigningKey(explicit?: string): string {
  const key =
    explicit ??
    process.env.AUTHORITY_LICENSE_DEV_SIGNING_KEY ??
    'authority-dev-license-key';
  if (key.length < 16) {
    throw new Error(
      'AUTHORITY_LICENSE_DEV_SIGNING_KEY must be at least 16 characters.',
    );
  }
  return key;
}

import { verifyLicensePayload, signLicensePayload } from './license-crypto';
import type { LicensePayload } from './license.constants';

describe('license-crypto', () => {
  const payload: LicensePayload = {
    plan: 'demo',
    maxSites: 2,
    maxUsers: 10,
    expiresAt: '2027-12-31T23:59:59.000Z',
    issuedAt: '2026-01-01T00:00:00.000Z',
  };

  it('signs and verifies a payload', () => {
    const signature = signLicensePayload(
      payload,
      'test-signing-key-32chars-min',
    );
    expect(
      verifyLicensePayload(payload, signature, 'test-signing-key-32chars-min'),
    ).toBe(true);
  });

  it('rejects tampered payloads', () => {
    const signature = signLicensePayload(
      payload,
      'test-signing-key-32chars-min',
    );
    const tampered = { ...payload, maxSites: 99 };
    expect(
      verifyLicensePayload(tampered, signature, 'test-signing-key-32chars-min'),
    ).toBe(false);
  });
});

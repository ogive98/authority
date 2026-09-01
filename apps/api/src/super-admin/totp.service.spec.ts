import { TotpService } from './totp.service';
import { encryptMfaSecret, decryptMfaSecret } from './mfa-crypto';
import { isSuperAdminMfaEnforced } from './super-admin.constants';

describe('TotpService', () => {
  const service = new TotpService();
  const secret = 'JBSWY3DPEHPK3PXP';

  it('validates a current TOTP code', () => {
    const code = service.generate(secret);
    expect(service.verify(secret, code)).toBe(true);
  });

  it('rejects a wrong code', () => {
    expect(service.verify(secret, '000000')).toBe(false);
  });
});

describe('mfa-crypto', () => {
  it('round-trips encrypted TOTP secrets', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptMfaSecret(encryptMfaSecret(secret))).toBe(secret);
  });
});

describe('isSuperAdminMfaEnforced', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) {
      delete process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;
    } else {
      process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED = previousFlag;
    }
  });

  it('is always on in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;
    expect(isSuperAdminMfaEnforced()).toBe(true);
  });

  it('is off in non-prod unless the flag is set', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;
    expect(isSuperAdminMfaEnforced()).toBe(false);
    process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED = 'true';
    expect(isSuperAdminMfaEnforced()).toBe(true);
  });
});

import {
  IamLifecycleStatus,
  IamSessionRealm,
  IamUserStatus,
} from '@prisma/client';
import { AuthService } from '../identity/auth.service';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { SessionService } from '../identity/session.service';
import { encryptMfaSecret, signMfaChallenge } from './mfa-crypto';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { SUPER_ADMIN_ERROR_CODES } from './super-admin.constants';
import { TotpService } from './totp.service';

describe('SuperAdminAuthService', () => {
  const saUser = {
    id: 'sa-1',
    email: 'superadmin@authority.local',
    displayName: 'Super Admin',
    status: IamUserStatus.ACTIVE,
    locale: 'fr-TN',
    timezone: 'Africa/Tunis',
    mfaEnabled: true,
    passwordHash: 'hash',
    deletedAt: null,
  };

  let prisma: {
    iamSuperAdminMembership: { findUnique: jest.Mock };
    iamMfaDevice: { findFirst: jest.Mock; update: jest.Mock };
    iamLoginAttempt: { create: jest.Mock };
    iamUser: { findUniqueOrThrow: jest.Mock };
  };
  let authService: { authenticatePassword: jest.Mock; toMeResponse: jest.Mock };
  let sessionService: { createSession: jest.Mock };
  let totpService: TotpService;
  let service: SuperAdminAuthService;

  beforeEach(() => {
    prisma = {
      iamSuperAdminMembership: { findUnique: jest.fn() },
      iamMfaDevice: { findFirst: jest.fn(), update: jest.fn() },
      iamLoginAttempt: { create: jest.fn() },
      iamUser: { findUniqueOrThrow: jest.fn() },
    };
    authService = {
      authenticatePassword: jest.fn().mockResolvedValue(saUser),
      toMeResponse: jest.fn().mockImplementation((user: typeof saUser) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        timezone: user.timezone,
        mfaEnabled: user.mfaEnabled,
      })),
    };
    sessionService = {
      createSession: jest.fn().mockResolvedValue({
        session: {
          id: 'sa-session-1',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
        token: 'sa-token',
      }),
    };
    totpService = new TotpService();
    service = new SuperAdminAuthService(
      prisma as never,
      authService as unknown as AuthService,
      sessionService as unknown as SessionService,
      totpService,
    );
    delete process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;
  });

  afterEach(() => {
    delete process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED;
  });

  it('creates a SUPER_ADMIN session when MFA is not enforced', async () => {
    prisma.iamSuperAdminMembership.findUnique.mockResolvedValue({
      status: IamLifecycleStatus.ACTIVE,
    });
    prisma.iamUser.findUniqueOrThrow.mockResolvedValue(saUser);

    const result = await service.login({
      email: saUser.email,
      password: 'SuperAdminPass123!',
    });

    expect(result.mfaRequired).toBe(false);
    if (!result.mfaRequired) {
      expect(result.token).toBe('sa-token');
    }
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: saUser.id,
        realm: IamSessionRealm.SUPER_ADMIN,
      }),
    );
  });

  it('rejects business users without membership using the same credentials error', async () => {
    prisma.iamSuperAdminMembership.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: saUser.email, password: 'SuperAdminPass123!' }),
    ).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
    });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('requires TOTP when MFA is enforced', async () => {
    process.env.AUTHORITY_SUPER_ADMIN_MFA_ENFORCED = 'true';
    prisma.iamSuperAdminMembership.findUnique.mockResolvedValue({
      status: IamLifecycleStatus.ACTIVE,
    });
    prisma.iamMfaDevice.findFirst.mockResolvedValue({
      id: 'mfa-1',
      secretEnc: encryptMfaSecret('JBSWY3DPEHPK3PXP'),
    });

    const result = await service.login({
      email: saUser.email,
      password: 'SuperAdminPass123!',
    });

    expect(result.mfaRequired).toBe(true);
    if (result.mfaRequired) {
      expect(result.mfaToken).toContain('.');
    }
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('completes login after a valid TOTP', async () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    prisma.iamSuperAdminMembership.findUnique.mockResolvedValue({
      status: IamLifecycleStatus.ACTIVE,
    });
    prisma.iamMfaDevice.findFirst.mockResolvedValue({
      id: 'mfa-1',
      secretEnc: encryptMfaSecret(secret),
    });
    prisma.iamUser.findUniqueOrThrow.mockResolvedValue(saUser);

    const mfaToken = signMfaChallenge({
      userId: saUser.id,
      exp: Date.now() + 60_000,
      realm: IamSessionRealm.SUPER_ADMIN,
    });
    const code = totpService.generate(secret);

    const result = await service.verifyMfa({ mfaToken, code });
    expect(result.token).toBe('sa-token');
    expect(prisma.iamMfaDevice.update).toHaveBeenCalled();
  });

  it('rejects an invalid TOTP code', async () => {
    prisma.iamSuperAdminMembership.findUnique.mockResolvedValue({
      status: IamLifecycleStatus.ACTIVE,
    });
    prisma.iamMfaDevice.findFirst.mockResolvedValue({
      id: 'mfa-1',
      secretEnc: encryptMfaSecret('JBSWY3DPEHPK3PXP'),
    });

    const mfaToken = signMfaChallenge({
      userId: saUser.id,
      exp: Date.now() + 60_000,
      realm: IamSessionRealm.SUPER_ADMIN,
    });

    await expect(
      service.verifyMfa({ mfaToken, code: '000000' }),
    ).rejects.toMatchObject({
      code: SUPER_ADMIN_ERROR_CODES.MFA_INVALID,
    });
  });
});

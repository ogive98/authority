import { IamUserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    iamUser: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    iamLoginAttempt: {
      create: jest.Mock;
      count: jest.Mock;
    };
  };
  let passwordService: { verify: jest.Mock };
  let sessionService: { createSession: jest.Mock };

  const activeUser = {
    id: 'user-1',
    email: 'demo@authority.local',
    displayName: 'Demo',
    status: IamUserStatus.ACTIVE,
    locale: 'fr-TN',
    timezone: 'Africa/Tunis',
    mfaEnabled: false,
    passwordHash: 'hash',
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = {
      iamUser: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      iamLoginAttempt: {
        create: jest.fn(),
        count: jest.fn(),
      },
    };
    passwordService = { verify: jest.fn() };
    sessionService = {
      createSession: jest.fn().mockResolvedValue({
        session: {
          id: 'session-1',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
        token: 'token-abc',
      }),
    };

    service = new AuthService(
      prisma as never,
      passwordService as unknown as PasswordService,
      sessionService as unknown as SessionService,
    );
  });

  it('logs in with valid credentials', async () => {
    prisma.iamUser.findUnique.mockResolvedValue(activeUser);
    passwordService.verify.mockResolvedValue(true);

    const result = await service.login({
      email: 'demo@authority.local',
      password: 'DemoPass123!',
    });

    expect(result.user.email).toBe('demo@authority.local');
    expect(result.token).toBe('token-abc');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        realm: 'BUSINESS',
      }),
    );
  });

  it('rejects invalid credentials without revealing user existence', async () => {
    prisma.iamUser.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@authority.local', password: 'wrong' }),
    ).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
    });
  });

  it('rejects locked accounts', async () => {
    prisma.iamUser.findUnique.mockResolvedValue({
      ...activeUser,
      status: IamUserStatus.LOCKED,
    });

    await expect(
      service.login({ email: activeUser.email, password: 'DemoPass123!' }),
    ).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.LOCKED,
    });
  });

  it('locks user after threshold failures', async () => {
    prisma.iamUser.findUnique.mockResolvedValue(activeUser);
    passwordService.verify.mockResolvedValue(false);
    prisma.iamLoginAttempt.count.mockResolvedValue(5);

    await expect(
      service.login({ email: activeUser.email, password: 'bad-password' }),
    ).rejects.toMatchObject({
      code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
    });

    expect(prisma.iamUser.update).toHaveBeenCalledWith({
      where: { id: activeUser.id },
      data: { status: IamUserStatus.LOCKED },
    });
  });
});

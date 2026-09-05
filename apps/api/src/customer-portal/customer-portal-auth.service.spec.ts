import {
  IamLifecycleStatus,
  IamSessionRealm,
  IamUserStatus,
} from '@prisma/client';
import { AuthService } from '../identity/auth.service';
import { IDENTITY_ERROR_CODES } from '../identity/identity.constants';
import { SessionService } from '../identity/session.service';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CUSTOMER_PORTAL_DEFAULTS } from './customer-portal.constants';

describe('CustomerPortalAuthService', () => {
  const portalUser = {
    id: 'portal-user-1',
    email: 'portal@authority.local',
    displayName: 'Portal Demo',
    status: IamUserStatus.ACTIVE,
    locale: 'fr-TN',
    timezone: 'Africa/Tunis',
    mfaEnabled: false,
    passwordHash: 'hash',
    deletedAt: null,
  };

  const membership = {
    id: 'mem-1',
    companyId: 'co-1',
    customerId: 'cus-1',
    userId: portalUser.id,
    role: 'buyer',
    status: IamLifecycleStatus.ACTIVE,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let prisma: {
    ptlMembership: { findFirst: jest.Mock };
    iamLoginAttempt: { create: jest.Mock };
    iamUser: { findUniqueOrThrow: jest.Mock };
    cusCustomer: { findFirst: jest.Mock };
  };
  let authService: { authenticatePassword: jest.Mock; toMeResponse: jest.Mock };
  let sessionService: { createSession: jest.Mock };
  let moduleRegistry: { isEnabled: jest.Mock };
  let service: CustomerPortalAuthService;

  beforeEach(() => {
    prisma = {
      ptlMembership: { findFirst: jest.fn() },
      iamLoginAttempt: { create: jest.fn() },
      iamUser: { findUniqueOrThrow: jest.fn() },
      cusCustomer: { findFirst: jest.fn() },
    };
    authService = {
      authenticatePassword: jest.fn().mockResolvedValue(portalUser),
      toMeResponse: jest.fn().mockImplementation((user: typeof portalUser) => ({
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
          id: 'portal-session-1',
          expiresAt: new Date('2026-12-31T00:00:00.000Z'),
        },
        token: 'portal-token',
      }),
    };
    moduleRegistry = {
      isEnabled: jest.fn().mockResolvedValue(true),
    };
    service = new CustomerPortalAuthService(
      prisma as never,
      authService as unknown as AuthService,
      sessionService as unknown as SessionService,
      moduleRegistry as never,
    );
  });

  it('creates a CUSTOMER_PORTAL session when membership is active', async () => {
    prisma.ptlMembership.findFirst.mockResolvedValue(membership);

    const result = await service.login({
      email: portalUser.email,
      password: 'PortalPass123!',
    });

    expect(result.token).toBe('portal-token');
    expect(result.membership.customerId).toBe('cus-1');
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: portalUser.id,
        realm: IamSessionRealm.CUSTOMER_PORTAL,
        ttlMs: CUSTOMER_PORTAL_DEFAULTS.sessionTtlHours * 60 * 60 * 1000,
      }),
    );
  });

  it('rejects login without active portal membership', async () => {
    prisma.ptlMembership.findFirst.mockResolvedValue(null);

    await expect(
      service.login({
        email: portalUser.email,
        password: 'PortalPass123!',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
      }),
    });
    expect(sessionService.createSession).not.toHaveBeenCalled();
  });

  it('returns me without internal notes', async () => {
    prisma.ptlMembership.findFirst.mockResolvedValue(membership);
    prisma.iamUser.findUniqueOrThrow.mockResolvedValue(portalUser);
    prisma.cusCustomer.findFirst.mockResolvedValue({
      id: 'cus-1',
      code: 'PORTAL-DEMO',
      blocked: false,
      party: { legalName: 'Portal Demo Customer' },
      internalNotes: 'SECRET — must not leak',
    });

    const me = await service.getMe(portalUser.id);

    expect(me.customer).toEqual({
      id: 'cus-1',
      code: 'PORTAL-DEMO',
      legalName: 'Portal Demo Customer',
      blocked: false,
    });
    expect(JSON.stringify(me)).not.toContain('SECRET');
    expect(me.realm).toBe('customer_portal');
  });
});

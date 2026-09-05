import { UnauthorizedException } from '@nestjs/common';
import { IamLifecycleStatus, IamSessionRealm, IamUserStatus } from '@prisma/client';
import { SessionService } from '../identity/session.service';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import { CustomerPortalSessionGuard } from './customer-portal-session.guard';
import {
  CUSTOMER_PORTAL_COOKIE_NAME,
  CUSTOMER_PORTAL_ERROR_CODES,
} from './customer-portal.constants';

describe('CustomerPortalSessionGuard', () => {
  const user = {
    id: 'portal-user-1',
    email: 'portal@authority.local',
    displayName: 'Portal Demo',
    status: IamUserStatus.ACTIVE,
    locale: 'fr-TN',
    timezone: 'Africa/Tunis',
    mfaEnabled: false,
  };

  const membership = {
    id: 'mem-1',
    companyId: 'co-1',
    customerId: 'cus-1',
    userId: user.id,
    role: 'buyer',
    status: IamLifecycleStatus.ACTIVE,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let sessionService: {
    findActiveSession: jest.Mock;
    assertEnvMatch: jest.Mock;
  };
  let portalAuthService: {
    findActiveMembership: jest.Mock;
    toMembershipSummary: jest.Mock;
  };
  let guard: CustomerPortalSessionGuard;

  beforeEach(() => {
    sessionService = {
      findActiveSession: jest.fn(),
      assertEnvMatch: jest.fn(),
    };
    portalAuthService = {
      findActiveMembership: jest.fn(),
      toMembershipSummary: jest.fn().mockImplementation((m: typeof membership) => ({
        id: m.id,
        customerId: m.customerId,
        companyId: m.companyId,
        role: m.role,
        status: m.status,
      })),
    };
    guard = new CustomerPortalSessionGuard(
      sessionService as unknown as SessionService,
      portalAuthService as unknown as CustomerPortalAuthService,
    );
  });

  function makeContext(cookies: Record<string, string> = {}) {
    const request: Record<string, unknown> = { cookies };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  }

  it('rejects missing cookie', async () => {
    const ctx = makeContext();
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects non-CUSTOMER_PORTAL / expired session', async () => {
    sessionService.findActiveSession.mockResolvedValue(null);
    const ctx = makeContext({ [CUSTOMER_PORTAL_COOKIE_NAME]: 'tok' });

    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.UNAUTHORIZED,
      }),
    });
    expect(sessionService.findActiveSession).toHaveBeenCalledWith(
      'tok',
      IamSessionRealm.CUSTOMER_PORTAL,
    );
  });

  it('rejects revoked membership (IDOR: no cross-tenant attach)', async () => {
    sessionService.findActiveSession.mockResolvedValue({
      id: 'sess-1',
      userId: user.id,
      realm: IamSessionRealm.CUSTOMER_PORTAL,
      user,
    });
    portalAuthService.findActiveMembership.mockResolvedValue(null);
    const ctx = makeContext({ [CUSTOMER_PORTAL_COOKIE_NAME]: 'tok' });

    await expect(guard.canActivate(ctx as never)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.UNAUTHORIZED,
      }),
    });
  });

  it('attaches membership customerId/companyId from session only', async () => {
    sessionService.findActiveSession.mockResolvedValue({
      id: 'sess-1',
      userId: user.id,
      realm: IamSessionRealm.CUSTOMER_PORTAL,
      user,
    });
    portalAuthService.findActiveMembership.mockResolvedValue(membership);
    const ctx = makeContext({ [CUSTOMER_PORTAL_COOKIE_NAME]: 'tok' });

    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(ctx.request.customerId).toBe('cus-1');
    expect(ctx.request.companyId).toBe('co-1');
    expect(ctx.request.portalMembership).toEqual(
      expect.objectContaining({ customerId: 'cus-1', companyId: 'co-1' }),
    );
    // Client cannot inject another customer via cookies alone
    expect(ctx.request.customerId).not.toBe('other-customer');
  });
});

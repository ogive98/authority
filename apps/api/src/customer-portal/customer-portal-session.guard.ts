import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import { AuthenticatedRequest } from '../identity/session.guard';
import { SessionService } from '../identity/session.service';
import { CustomerPortalAuthService } from './customer-portal-auth.service';
import {
  CUSTOMER_PORTAL_COOKIE_NAME,
  CUSTOMER_PORTAL_ERROR_CODES,
} from './customer-portal.constants';
import type { PortalMembershipSummary } from './customer-portal-auth.service';

export type CustomerPortalRequest = AuthenticatedRequest & {
  portalMembership?: PortalMembershipSummary;
  customerId?: string;
  companyId?: string;
};

@Injectable()
export class CustomerPortalSessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly portalAuthService: CustomerPortalAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<CustomerPortalRequest>();
    const token = request.cookies?.[CUSTOMER_PORTAL_COOKIE_NAME] as
      | string
      | undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: CUSTOMER_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Customer Portal authentication required.',
      });
    }

    const session = await this.sessionService.findActiveSession(
      token,
      IamSessionRealm.CUSTOMER_PORTAL,
    );
    if (!session) {
      throw new UnauthorizedException({
        code: CUSTOMER_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Customer Portal session expired or revoked.',
      });
    }

    this.sessionService.assertEnvMatch(session);

    const membership = await this.portalAuthService.findActiveMembership(
      session.userId,
    );
    if (!membership) {
      throw new UnauthorizedException({
        code: CUSTOMER_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Customer Portal membership is not active.',
      });
    }

    const summary = this.portalAuthService.toMembershipSummary(membership);
    request.session = session;
    request.user = session.user;
    request.portalMembership = summary;
    request.customerId = summary.customerId;
    request.companyId = summary.companyId;
    return true;
  }
}

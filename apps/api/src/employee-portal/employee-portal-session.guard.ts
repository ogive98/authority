import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import { AuthenticatedRequest } from '../identity/session.guard';
import { SessionService } from '../identity/session.service';
import {
  EMPLOYEE_PORTAL_COOKIE_NAME,
  EMPLOYEE_PORTAL_ERROR_CODES,
} from './employee-portal.constants';
import {
  EmployeePortalAuthService,
  type EmployeePortalLink,
} from './employee-portal-auth.service';

export type EmployeePortalRequest = AuthenticatedRequest & {
  portalEmployee?: EmployeePortalLink;
  employeeId?: string;
  companyId?: string;
};

@Injectable()
export class EmployeePortalSessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly portalAuthService: EmployeePortalAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<EmployeePortalRequest>();
    const token = request.cookies?.[EMPLOYEE_PORTAL_COOKIE_NAME] as
      | string
      | undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: EMPLOYEE_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Employee Portal authentication required.',
      });
    }

    const session = await this.sessionService.findActiveSession(
      token,
      IamSessionRealm.EMPLOYEE_PORTAL,
    );
    if (!session) {
      throw new UnauthorizedException({
        code: EMPLOYEE_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Employee Portal session expired or revoked.',
      });
    }

    this.sessionService.assertEnvMatch(session);

    const employee = await this.portalAuthService.findLinkedEmployee(
      session.userId,
    );
    if (!employee) {
      throw new UnauthorizedException({
        code: EMPLOYEE_PORTAL_ERROR_CODES.UNAUTHORIZED,
        message: 'Employee Portal link is not active.',
      });
    }

    const link = this.portalAuthService.toLink(employee);
    request.session = session;
    request.user = session.user;
    request.portalEmployee = link;
    request.employeeId = link.employeeId;
    request.companyId = link.companyId;
    return true;
  }
}

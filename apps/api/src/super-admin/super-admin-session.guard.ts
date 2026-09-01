import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import { AuthenticatedRequest } from '../identity/session.guard';
import { SessionService } from '../identity/session.service';
import { SuperAdminAuthService } from './super-admin-auth.service';
import {
  SUPER_ADMIN_COOKIE_NAME,
  SUPER_ADMIN_ERROR_CODES,
} from './super-admin.constants';

@Injectable()
export class SuperAdminSessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly superAdminAuthService: SuperAdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SUPER_ADMIN_COOKIE_NAME] as
      string | undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: SUPER_ADMIN_ERROR_CODES.UNAUTHORIZED,
        message: 'Super Admin authentication required.',
      });
    }

    const session = await this.sessionService.findActiveSession(
      token,
      IamSessionRealm.SUPER_ADMIN,
    );
    if (!session) {
      throw new UnauthorizedException({
        code: SUPER_ADMIN_ERROR_CODES.UNAUTHORIZED,
        message: 'Super Admin session expired or revoked.',
      });
    }

    this.sessionService.assertEnvMatch(session);

    const membership = await this.superAdminAuthService.hasActiveMembership(
      session.userId,
    );
    if (!membership) {
      throw new UnauthorizedException({
        code: SUPER_ADMIN_ERROR_CODES.UNAUTHORIZED,
        message: 'Super Admin membership is not active.',
      });
    }

    request.session = session;
    request.user = session.user;
    return true;
  }
}

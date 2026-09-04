import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import { Request } from 'express';
import {
  IDENTITY_COOKIE_NAME,
  IDENTITY_ERROR_CODES,
} from './identity.constants';
import { SessionService, SessionWithUser } from './session.service';

export type AuthenticatedRequest = Request & {
  session?: SessionWithUser;
  user?: SessionWithUser['user'];
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[IDENTITY_COOKIE_NAME] as string | undefined;

    if (!token) {
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
        message: 'Authentication required.',
      });
    }

    try {
      const session = await this.sessionService.findActiveSession(
        token,
        IamSessionRealm.BUSINESS,
      );
      if (!session) {
        throw new UnauthorizedException({
          code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
          message: 'Session expired or revoked.',
        });
      }

      this.sessionService.assertEnvMatch(session);

      request.session = session;
      request.user = session.user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // DB / Redis down must not surface as opaque 500 on every shell call.
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
        message: 'Session store unavailable.',
      });
    }
  }
}

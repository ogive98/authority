import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IamSessionRealm } from '@prisma/client';
import { Request } from 'express';
import { TENANCY_COOKIES } from '../organization/organization.constants';
import { DeviceService } from './device.service';
import {
  IDENTITY_COOKIE_NAME,
  IDENTITY_ERROR_CODES,
} from './identity.constants';
import { SessionService, SessionWithUser } from './session.service';

export type AuthSource = 'cookie' | 'device';

export type AuthenticatedRequest = Request & {
  session?: SessionWithUser;
  user?: SessionWithUser['user'];
  authSource?: AuthSource;
  authorityDevice?: { id: string; companyId: string };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookieToken = request.cookies?.[IDENTITY_COOKIE_NAME] as
      | string
      | undefined;

    if (cookieToken) {
      return this.activateCookie(request, cookieToken);
    }

    const bearer = readBearer(request);
    if (bearer) {
      return this.activateDevice(request, bearer);
    }

    throw new UnauthorizedException({
      code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
      message: 'Authentication required.',
    });
  }

  private async activateCookie(
    request: AuthenticatedRequest,
    token: string,
  ): Promise<boolean> {
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

      request.authSource = 'cookie';
      request.session = session;
      request.user = session.user;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
        message: 'Session store unavailable.',
      });
    }
  }

  private async activateDevice(
    request: AuthenticatedRequest,
    token: string,
  ): Promise<boolean> {
    try {
      const device = await this.deviceService.findActiveByToken(token);
      if (!device) {
        throw new UnauthorizedException({
          code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
          message: 'Device token expired or revoked.',
        });
      }

      request.authSource = 'device';
      request.authorityDevice = {
        id: device.id,
        companyId: device.companyId,
      };
      request.user = device.user;
      const cookies = (request.cookies ?? {}) as Record<string, string>;
      cookies[TENANCY_COOKIES.companyId] = device.companyId;
      request.cookies = cookies;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new UnauthorizedException({
        code: IDENTITY_ERROR_CODES.UNAUTHORIZED,
        message: 'Device store unavailable.',
      });
    }
  }
}

function readBearer(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  return match?.[1];
}

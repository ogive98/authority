import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../identity/session.guard';
import {
  TENANCY_COOKIES,
  TENANCY_HEADERS,
} from '../organization/organization.constants';
import {
  PERMISSION_ERROR_CODES,
  PERMISSION_METADATA_KEY,
  type PermissionKey,
} from './permission.constants';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<PermissionKey>(
      PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException({
        code: PERMISSION_ERROR_CODES.FORBIDDEN,
        message: 'Permission denied.',
      });
    }

    const cookies = (request.cookies ?? {}) as Record<
      string,
      string | undefined
    >;
    const companyId =
      header(request.headers[TENANCY_HEADERS.companyId]) ??
      cookies[TENANCY_COOKIES.companyId];
    const siteId =
      header(request.headers[TENANCY_HEADERS.siteId]) ??
      cookies[TENANCY_COOKIES.siteId];

    const allowed = await this.permissionService.evaluate(userId, permission, {
      companyId,
      siteId,
    });

    if (!allowed) {
      throw new ForbiddenException({
        code: PERMISSION_ERROR_CODES.FORBIDDEN,
        message: 'Permission denied.',
      });
    }

    return true;
  }
}

function header(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

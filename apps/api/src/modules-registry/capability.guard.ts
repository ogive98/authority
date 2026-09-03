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
import { CapabilityResolverService } from './catalog/capability-resolver.service';
import { ModuleRegistryService } from './module-registry.service';
import {
  CAPABILITY_ERROR_CODES,
  CAPABILITY_METADATA_KEY,
} from './modules.constants';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: CapabilityResolverService,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const capabilityKey = this.reflector.getAllAndOverride<string>(
      CAPABILITY_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!capabilityKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw this.forbidden(
        CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
        'Capability requires an authenticated user.',
      );
    }

    const cookies = (request.cookies ?? {}) as Record<
      string,
      string | undefined
    >;
    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      request.headers,
      cookies,
    );
    if (!companyId) {
      throw this.forbidden(
        CAPABILITY_ERROR_CODES.MODULE_DISABLED,
        'Company context required for capability resolution.',
      );
    }

    const siteId =
      header(request.headers[TENANCY_HEADERS.siteId]) ??
      cookies[TENANCY_COOKIES.siteId];

    const result = await this.resolver.resolve(capabilityKey, {
      companyId,
      userId,
      siteId,
    });

    if (!result.allowed) {
      throw this.forbidden(result.code, result.message);
    }

    return true;
  }

  private forbidden(code: string, message: string): ForbiddenException {
    return new ForbiddenException({ code, message });
  }
}

function header(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

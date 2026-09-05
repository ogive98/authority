import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
import { MODULE_ERROR_CODES } from '../modules-registry/modules.constants';
import { MODULE_METADATA_KEY } from '../modules-registry/modules.constants';
import type { CustomerPortalRequest } from './customer-portal-session.guard';

/**
 * Portal-aware module gate — uses session companyId (not staff tenancy cookies).
 * Always requires `portals` ENABLED; optional extra keys via @RequireModule on handler.
 */
@Injectable()
export class CustomerPortalModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<CustomerPortalRequest>();
    const companyId = request.companyId;
    if (!companyId) {
      throw this.disabled();
    }

    const extra = this.reflector.getAllAndOverride<string>(MODULE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const keys = new Set<string>(['portals']);
    if (extra && extra !== 'portals') {
      keys.add(extra);
    }

    for (const key of keys) {
      if (!(await this.moduleRegistry.isEnabled(companyId, key))) {
        throw this.disabled();
      }
    }

    return true;
  }

  private disabled(): ForbiddenException {
    return new ForbiddenException({
      code: MODULE_ERROR_CODES.DISABLED,
      message: 'Module is disabled.',
    });
  }
}

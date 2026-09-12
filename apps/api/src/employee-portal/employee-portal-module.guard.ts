import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModuleRegistryService } from '../modules-registry/module-registry.service';
import {
  MODULE_ERROR_CODES,
  MODULE_METADATA_KEY,
} from '../modules-registry/modules.constants';
import type { EmployeePortalRequest } from './employee-portal-session.guard';

/**
 * Portal-aware module gate — uses employee companyId (not staff tenancy).
 * Always requires `portals` + `attendance` ENABLED.
 */
@Injectable()
export class EmployeePortalModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<EmployeePortalRequest>();
    const companyId = request.companyId;
    if (!companyId) {
      throw this.disabled();
    }

    const extra = this.reflector.getAllAndOverride<string>(MODULE_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const keys = new Set<string>(['portals', 'attendance']);
    if (extra) {
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

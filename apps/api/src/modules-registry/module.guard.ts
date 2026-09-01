import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../identity/session.guard';
import { ModuleRegistryService } from './module-registry.service';
import { MODULE_ERROR_CODES, MODULE_METADATA_KEY } from './modules.constants';

@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const moduleKey = this.reflector.getAllAndOverride<string>(
      MODULE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!moduleKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw this.disabled();
    }

    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      request.headers,
      (request.cookies ?? {}) as Record<string, string | undefined>,
    );
    if (!companyId) {
      throw this.disabled();
    }

    if (!(await this.moduleRegistry.isEnabled(companyId, moduleKey))) {
      throw this.disabled();
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

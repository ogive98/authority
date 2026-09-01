import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../identity/session.guard';
import { FeatureFlagService } from './feature-flag.service';
import { ModuleRegistryService } from './module-registry.service';
import { FLAG_METADATA_KEY, MODULE_ERROR_CODES } from './modules.constants';

@Injectable()
export class FlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlagService,
    private readonly moduleRegistry: ModuleRegistryService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(
      FLAG_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!flagKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw this.off();
    }

    const companyId = await this.moduleRegistry.resolveCompanyId(
      userId,
      request.headers,
      (request.cookies ?? {}) as Record<string, string | undefined>,
    );
    if (!companyId || !(await this.flags.isEnabled(companyId, flagKey))) {
      throw this.off();
    }

    return true;
  }

  private off(): ForbiddenException {
    return new ForbiddenException({
      code: MODULE_ERROR_CODES.FLAG_OFF,
      message: 'Feature flag is off.',
    });
  }
}

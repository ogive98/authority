import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../identity/session.guard';
import { ORG_ERROR_CODES } from './organization.constants';
import { TenancyService } from './tenancy.service';

export type TenancyRequest = AuthenticatedRequest & {
  tenancy?: { companyId: string; siteId?: string };
};

@Injectable()
export class TenancyGuard implements CanActivate {
  constructor(private readonly tenancyService: TenancyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenancyRequest>();

    if (!request.user) {
      return false;
    }

    const tenancy = await this.tenancyService.resolveContext(
      request.user.id,
      request.headers,
      request.cookies as Record<string, string | undefined>,
    );

    if (!tenancy) {
      throw new ForbiddenException({
        code: ORG_ERROR_CODES.CONTEXT_FORBIDDEN,
        message: 'Tenancy context required (company_id).',
      });
    }

    request.tenancy = tenancy;
    return true;
  }
}

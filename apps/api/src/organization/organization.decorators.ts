import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenancyRequest } from './tenancy.guard';

export const CurrentTenancy = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<TenancyRequest>();
    return request.tenancy!;
  },
);

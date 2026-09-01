import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './session.guard';
import { SessionWithUser } from './session.service';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionWithUser => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.session!;
  },
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionWithUser['user'] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user!;
  },
);

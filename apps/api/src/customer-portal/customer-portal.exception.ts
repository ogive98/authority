import { HttpException, HttpStatus } from '@nestjs/common';
import type { CustomerPortalErrorCode } from './customer-portal.constants';

export class CustomerPortalException extends HttpException {
  constructor(
    public readonly code: CustomerPortalErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

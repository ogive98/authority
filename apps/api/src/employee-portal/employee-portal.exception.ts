import { HttpException, HttpStatus } from '@nestjs/common';
import type { EmployeePortalErrorCode } from './employee-portal.constants';

export class EmployeePortalException extends HttpException {
  constructor(
    public readonly code: EmployeePortalErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

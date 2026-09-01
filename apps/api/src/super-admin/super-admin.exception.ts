import { HttpException, HttpStatus } from '@nestjs/common';
import type { SuperAdminErrorCode } from './super-admin.constants';

export class SuperAdminException extends HttpException {
  constructor(
    public readonly code: SuperAdminErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

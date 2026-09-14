import { HttpException, HttpStatus } from '@nestjs/common';
import type { MntErrorCode } from './maintenance.constants';

export class MaintenanceException extends HttpException {
  constructor(
    public readonly code: MntErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

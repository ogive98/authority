import { HttpException, HttpStatus } from '@nestjs/common';
import type { HrErrorCode } from './hr.constants';

export class HrException extends HttpException {
  constructor(
    public readonly code: HrErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

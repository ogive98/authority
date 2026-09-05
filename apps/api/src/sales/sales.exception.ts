import { HttpException, HttpStatus } from '@nestjs/common';
import type { SalesErrorCode } from './sales.constants';

export class SalesException extends HttpException {
  constructor(
    public readonly code: SalesErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

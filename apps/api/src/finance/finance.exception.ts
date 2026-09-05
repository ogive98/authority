import { HttpException, HttpStatus } from '@nestjs/common';
import type { FinanceErrorCode } from './finance.constants';

export class FinanceException extends HttpException {
  constructor(
    public readonly code: FinanceErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

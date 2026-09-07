import { HttpException, HttpStatus } from '@nestjs/common';
import type { AccountingErrorCode } from './accounting.constants';

export class AccountingException extends HttpException {
  constructor(
    public readonly code: AccountingErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

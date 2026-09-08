import { HttpException, HttpStatus } from '@nestjs/common';
import type { TaxErrorCode } from './tax.constants';

export class TaxException extends HttpException {
  constructor(
    public readonly code: TaxErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

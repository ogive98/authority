import { HttpException, HttpStatus } from '@nestjs/common';
import type { SuppliersErrorCode } from './suppliers.constants';

export class SuppliersException extends HttpException {
  constructor(
    public readonly code: SuppliersErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

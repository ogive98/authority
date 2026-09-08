import { HttpException, HttpStatus } from '@nestjs/common';
import type { ProductionErrorCode } from './production.constants';

export class ProductionException extends HttpException {
  constructor(
    public readonly code: ProductionErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

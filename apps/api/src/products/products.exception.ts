import { HttpException, HttpStatus } from '@nestjs/common';
import type { ProductsErrorCode } from './products.constants';

export class ProductsException extends HttpException {
  constructor(
    public readonly code: ProductsErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

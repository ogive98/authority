import { HttpException, HttpStatus } from '@nestjs/common';
import type { CustomersErrorCode } from './customers.constants';

export class CustomersException extends HttpException {
  constructor(
    public readonly code: CustomersErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

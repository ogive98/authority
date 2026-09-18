import { HttpException, HttpStatus } from '@nestjs/common';
import type { ReturnsErrorCode } from './returns.constants';

export class ReturnsException extends HttpException {
  constructor(
    public readonly code: ReturnsErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

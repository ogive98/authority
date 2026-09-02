import { HttpException, HttpStatus } from '@nestjs/common';
import type { PlatformErrorCode } from './platform.constants';

export class PlatformException extends HttpException {
  constructor(
    public readonly code: PlatformErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

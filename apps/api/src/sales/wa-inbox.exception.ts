import { HttpException, HttpStatus } from '@nestjs/common';
import type { WaInboxErrorCode } from './wa-inbox.constants';

export class WaInboxException extends HttpException {
  constructor(
    public readonly code: WaInboxErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

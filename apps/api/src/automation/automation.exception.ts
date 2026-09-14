import { HttpException, HttpStatus } from '@nestjs/common';
import type { AutomationErrorCode } from './automation.constants';

export class AutomationException extends HttpException {
  constructor(
    public readonly code: AutomationErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';
import type { FleetErrorCode } from './fleet.constants';

export class FleetException extends HttpException {
  constructor(
    public readonly code: FleetErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

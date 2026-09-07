import { HttpException, HttpStatus } from '@nestjs/common';
import type { RepairErrorCode } from './repair.constants';

export class RepairException extends HttpException {
  constructor(
    public readonly code: RepairErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';
import type { ProcurementErrorCode } from './procurement.constants';

export class ProcurementException extends HttpException {
  constructor(
    public readonly code: ProcurementErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

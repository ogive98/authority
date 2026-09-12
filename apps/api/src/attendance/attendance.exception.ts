import { HttpException, HttpStatus } from '@nestjs/common';
import type { AttendanceErrorCode } from './attendance.constants';

export class AttendanceException extends HttpException {
  constructor(
    public readonly code: AttendanceErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

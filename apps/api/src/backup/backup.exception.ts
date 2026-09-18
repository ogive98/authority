import { HttpException, HttpStatus } from '@nestjs/common';
import type { BackupErrorCode } from './backup.constants';

export class BackupException extends HttpException {
  readonly code: BackupErrorCode;

  constructor(
    code: BackupErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
    this.code = code;
  }
}

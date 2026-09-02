import { HttpException, HttpStatus } from '@nestjs/common';
import type { LicenseErrorCode } from './license.constants';

export class LicenseException extends HttpException {
  constructor(
    public readonly code: LicenseErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.FORBIDDEN,
  ) {
    super({ code, message }, status);
  }
}

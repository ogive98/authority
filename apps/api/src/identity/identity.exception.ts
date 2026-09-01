import { HttpException, HttpStatus } from '@nestjs/common';
import type { IdentityErrorCode } from './identity.constants';

export class IdentityException extends HttpException {
  constructor(
    public readonly code: IdentityErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

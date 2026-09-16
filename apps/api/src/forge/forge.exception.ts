import { HttpException, HttpStatus } from '@nestjs/common';
import type { ForgeErrorCode } from './forge.constants';

export class ForgeException extends HttpException {
  constructor(
    public readonly code: ForgeErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

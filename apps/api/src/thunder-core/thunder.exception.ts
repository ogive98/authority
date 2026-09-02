import { HttpException, HttpStatus } from '@nestjs/common';
import type { ThunderErrorCode } from './thunder.constants';

export class ThunderException extends HttpException {
  constructor(
    public readonly code: ThunderErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

export class ModulesException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';

export class TraceabilityException extends HttpException {
  constructor(code: string, message: string) {
    super({ code, message }, HttpStatus.BAD_REQUEST);
  }
}

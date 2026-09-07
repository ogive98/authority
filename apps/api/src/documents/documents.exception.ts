import { HttpException, HttpStatus } from '@nestjs/common';
import type { DocumentsErrorCode } from './documents.constants';

export class DocumentsException extends HttpException {
  constructor(
    public readonly code: DocumentsErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

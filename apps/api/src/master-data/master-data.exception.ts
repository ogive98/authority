import { HttpException, HttpStatus } from '@nestjs/common';

export class MasterDataException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
  ) {
    super({ code, message }, status);
  }
}

import { HttpException, HttpStatus } from '@nestjs/common';
import type { OrgErrorCode } from './organization.constants';

export class OrganizationException extends HttpException {
  constructor(
    public readonly code: OrgErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.FORBIDDEN,
  ) {
    super({ code, message }, status);
  }
}

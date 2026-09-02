import { HttpException, HttpStatus } from '@nestjs/common';
import type { SettingsErrorCode } from './settings.constants';

export class SettingsException extends HttpException {
  constructor(
    public readonly code: SettingsErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

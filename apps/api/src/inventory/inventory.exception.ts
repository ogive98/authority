import { HttpException, HttpStatus } from '@nestjs/common';
import type { InventoryErrorCode } from './inventory.constants';

export class InventoryException extends HttpException {
  constructor(
    public readonly code: InventoryErrorCode,
    message: string,
    status: HttpStatus,
    extras?: Record<string, unknown>,
  ) {
    super({ code, message, ...extras }, status);
  }
}

import { SetMetadata } from '@nestjs/common';
import {
  PERMISSION_METADATA_KEY,
  type PermissionKey,
} from './permission.constants';

export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(PERMISSION_METADATA_KEY, permission);

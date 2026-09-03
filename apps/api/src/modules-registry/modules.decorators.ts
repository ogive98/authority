import { SetMetadata } from '@nestjs/common';
import {
  CAPABILITY_METADATA_KEY,
  FLAG_METADATA_KEY,
  MODULE_METADATA_KEY,
} from './modules.constants';

export const RequireModule = (moduleKey: string) =>
  SetMetadata(MODULE_METADATA_KEY, moduleKey);

export const RequireFlag = (flagKey: string) =>
  SetMetadata(FLAG_METADATA_KEY, flagKey);

export const RequireCapability = (capabilityKey: string) =>
  SetMetadata(CAPABILITY_METADATA_KEY, capabilityKey);

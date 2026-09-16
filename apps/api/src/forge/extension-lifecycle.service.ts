import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  FrgExtensionStatus,
  FrgFeatureRequestStatus,
  FrgMetadataStatus,
} from '@prisma/client';
import {
  FORGE_ERROR_CODES,
  FORGE_EXTENSION_TRANSITIONS,
  FORGE_FEATURE_REQUEST_TRANSITIONS,
  FORGE_METADATA_TRANSITIONS,
} from './forge.constants';
import { ForgeException } from './forge.exception';

@Injectable()
export class ExtensionLifecycleService {
  canTransitionExtension(from: FrgExtensionStatus, to: FrgExtensionStatus): boolean {
    if (from === to) return true;
    return FORGE_EXTENSION_TRANSITIONS.some((t) => t.from === from && t.to === to);
  }

  assertExtensionTransition(from: FrgExtensionStatus, to: FrgExtensionStatus): void {
    if (!this.canTransitionExtension(from, to)) {
      throw new ForgeException(
        FORGE_ERROR_CODES.INVALID_TRANSITION,
        `Extension status transition ${from} → ${to} is not allowed.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  canTransitionFeatureRequest(
    from: FrgFeatureRequestStatus,
    to: FrgFeatureRequestStatus,
  ): boolean {
    if (from === to) return true;
    return FORGE_FEATURE_REQUEST_TRANSITIONS.some(
      (t) => t.from === from && t.to === to,
    );
  }

  assertFeatureRequestTransition(
    from: FrgFeatureRequestStatus,
    to: FrgFeatureRequestStatus,
  ): void {
    if (!this.canTransitionFeatureRequest(from, to)) {
      throw new ForgeException(
        FORGE_ERROR_CODES.INVALID_TRANSITION,
        `Feature request status transition ${from} → ${to} is not allowed.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  canTransitionMetadata(from: FrgMetadataStatus, to: FrgMetadataStatus): boolean {
    if (from === to) return true;
    return FORGE_METADATA_TRANSITIONS.some((t) => t.from === from && t.to === to);
  }

  assertMetadataTransition(from: FrgMetadataStatus, to: FrgMetadataStatus): void {
    if (!this.canTransitionMetadata(from, to)) {
      throw new ForgeException(
        FORGE_ERROR_CODES.INVALID_TRANSITION,
        `Metadata status transition ${from} → ${to} is not allowed.`,
        HttpStatus.CONFLICT,
      );
    }
  }
}

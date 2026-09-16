import type {
  FrgExtensionStatus,
  FrgFeatureRequestStatus,
  FrgMetadataStatus,
} from '@prisma/client';

export const FORGE_ERROR_CODES = {
  NOT_FOUND: 'FORGE.NOT_FOUND',
  DUPLICATE_KEY: 'FORGE.DUPLICATE_KEY',
  INVALID_STATUS: 'FORGE.INVALID_STATUS',
  INVALID_TRANSITION: 'FORGE.INVALID_TRANSITION',
  TENANT_FORBIDDEN: 'FORGE.TENANT_FORBIDDEN',
  VALIDATION: 'FORGE.VALIDATION',
} as const;

export type ForgeErrorCode =
  (typeof FORGE_ERROR_CODES)[keyof typeof FORGE_ERROR_CODES];

export const FORGE_EVENT_TYPES = {
  EXTENSION_CREATED: 'forge.extension.created.v1',
  EXTENSION_STATUS_CHANGED: 'forge.extension.status_changed.v1',
  FEATURE_REQUEST_CREATED: 'forge.feature_request.created.v1',
  FEATURE_REQUEST_STATUS_CHANGED: 'forge.feature_request.status_changed.v1',
  METADATA_CREATED: 'forge.metadata.created.v1',
  METADATA_STATUS_CHANGED: 'forge.metadata.status_changed.v1',
} as const;

export const FORGE_AUDIT_ENTITY_TYPES = {
  extension: 'frg_extension',
  featureRequest: 'frg_feature_request',
  metadataDefinition: 'frg_metadata_definition',
} as const;

/** Valid extension lifecycle transitions (deterministic, no DRAFT→ACTIVE). */
export const FORGE_EXTENSION_TRANSITIONS: ReadonlyArray<{
  from: FrgExtensionStatus;
  to: FrgExtensionStatus;
}> = [
  { from: 'DRAFT', to: 'ANALYZING' },
  { from: 'ANALYZING', to: 'VALIDATING' },
  { from: 'ANALYZING', to: 'GENERATING' },
  { from: 'GENERATING', to: 'VALIDATING' },
  { from: 'VALIDATING', to: 'TESTING' },
  { from: 'VALIDATING', to: 'FAILED' },
  { from: 'TESTING', to: 'READY_FOR_REVIEW' },
  { from: 'TESTING', to: 'FAILED' },
  { from: 'READY_FOR_REVIEW', to: 'APPROVED' },
  { from: 'READY_FOR_REVIEW', to: 'DRAFT' },
  { from: 'APPROVED', to: 'ACTIVE' },
  { from: 'ACTIVE', to: 'SUSPENDED' },
  { from: 'ACTIVE', to: 'DISABLED' },
  { from: 'SUSPENDED', to: 'ACTIVE' },
  { from: 'SUSPENDED', to: 'DISABLED' },
  { from: 'DISABLED', to: 'ARCHIVED' },
  { from: 'FAILED', to: 'DRAFT' },
  { from: 'FAILED', to: 'ARCHIVED' },
  { from: 'DRAFT', to: 'ARCHIVED' },
];

export const FORGE_FEATURE_REQUEST_TRANSITIONS: ReadonlyArray<{
  from: FrgFeatureRequestStatus;
  to: FrgFeatureRequestStatus;
}> = [
  { from: 'RECEIVED', to: 'ANALYZING' },
  { from: 'ANALYZING', to: 'PLANNED' },
  { from: 'ANALYZING', to: 'REJECTED' },
  { from: 'PLANNED', to: 'WAITING_APPROVAL' },
  { from: 'WAITING_APPROVAL', to: 'IMPLEMENTING' },
  { from: 'WAITING_APPROVAL', to: 'REJECTED' },
  { from: 'IMPLEMENTING', to: 'TESTING' },
  { from: 'TESTING', to: 'READY' },
  { from: 'TESTING', to: 'FAILED' },
  { from: 'READY', to: 'DEPLOYED' },
  { from: 'FAILED', to: 'RECEIVED' },
  { from: 'RECEIVED', to: 'REJECTED' },
];

/** Metadata status — DRAFT → ACTIVE → ARCHIVED (no reactivation from ARCHIVED). */
export const FORGE_METADATA_TRANSITIONS: ReadonlyArray<{
  from: FrgMetadataStatus;
  to: FrgMetadataStatus;
}> = [
  { from: 'DRAFT', to: 'ACTIVE' },
  { from: 'DRAFT', to: 'ARCHIVED' },
  { from: 'ACTIVE', to: 'ARCHIVED' },
  { from: 'ACTIVE', to: 'DRAFT' },
];

export const AUDIT_ACTIONS = {
  identityUserUpdate: 'identity.user.update',
} as const;

export const OUTBOX_EVENT_TYPES = {
  identityUserUpdated: 'identity.user.updated.v1',
  platformNumberAllocated: 'platform.number.allocated.v1',
  platformFileUploaded: 'platform.file.uploaded.v1',
} as const;

export const AUDIT_ENTITY_TYPES = {
  iamUser: 'iam_user',
} as const;

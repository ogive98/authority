export const BACKUP_ERROR_CODES = {
  NOT_FOUND: 'BCK.NOT_FOUND',
  STATE: 'BCK.STATE',
  LOCKED: 'BCK.LOCKED',
  RESTORE_NOT_INSTALLABLE: 'BCK.RESTORE_NOT_INSTALLABLE',
  REAUTH_REQUIRED: 'BCK.REAUTH_REQUIRED',
  DUAL_CONTROL_REQUIRED: 'BCK.DUAL_CONTROL_REQUIRED',
  SAME_APPROVER: 'BCK.SAME_APPROVER',
  RESTORE_APPLY_DEFERRED: 'BCK.RESTORE_APPLY_DEFERRED',
  RESTORE_CLUSTER_BLOCKED: 'BCK.RESTORE_CLUSTER_BLOCKED',
  RESTORE_CONFIRM_REQUIRED: 'BCK.RESTORE_CONFIRM_REQUIRED',
  RESTORE_HEALTH_FAILED: 'BCK.RESTORE_HEALTH_FAILED',
  ARTIFACT_MISSING: 'BCK.ARTIFACT_MISSING',
  DEST_UNAVAILABLE: 'BCK.DEST_UNAVAILABLE',
  DUMP_FAILED: 'BCK.DUMP_FAILED',
  FEATURE_DISABLED: 'BCK.FEATURE_DISABLED',
  PATH_FORBIDDEN: 'BCK.PATH_FORBIDDEN',
  PATH_NOT_FOUND: 'BCK.PATH_NOT_FOUND',
  PATH_TRAVERSAL: 'BCK.PATH_TRAVERSAL',
  MAX_SIZE_EXCEEDED: 'BCK.MAX_SIZE_EXCEEDED',
  DESTINATION_UNSUPPORTED: 'BCK.DESTINATION_UNSUPPORTED',
  DESTINATION_DENIED: 'BCK.DESTINATION_DENIED',
  EMPTY_SELECTION: 'BCK.EMPTY_SELECTION',
} as const;

export type BackupErrorCode =
  (typeof BACKUP_ERROR_CODES)[keyof typeof BACKUP_ERROR_CODES];

/** Relative root under process.cwd() for LOCAL_FS destinations (D304+). */
export const BACKUP_LOCAL_ROOT = 'data/backups';

/** Company-scoped file sandbox for SPECIFIC_FOLDERS (D313). */
export const BACKUP_COMPANY_FILES_ROOT = 'data/company-files';

/**
 * Suggested business folder names under company sandbox (D314).
 * Empty shells only — never auto-seeded with content.
 */
export const BUSINESS_FOLDER_TEMPLATES = [
  'comptabilite',
  'finance',
  'banque',
  'documents',
  'rh',
] as const;

/** Thunder HOW job types owned by Backup domain (D306–D313). */
export const BACKUP_JOB_TYPES = {
  retentionRun: 'backup.retention.run.v1',
  autoBackupCreate: 'backup.auto.create.v1',
  specificFoldersCreate: 'backup.specificFolders.create.v1',
} as const;

export const RESTORE_CONFIRM_PHRASE = 'RESTORE';

export type SpecificFolderDestinationMode = 'LOCAL_DISK' | 'DOWNLOAD';

export const SPECIFIC_FOLDER_UNSUPPORTED_DESTINATIONS = [
  'EXTERNAL_DISK',
  'NAS',
  'NETWORK_SHARE',
  'OBJECT_STORAGE',
  'REMOTE_SERVER',
] as const;

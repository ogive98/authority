export const PLATFORM_ERROR_CODES = {
  SERIES_MISSING: 'PLT.SERIES_MISSING',
  FILE_TOO_LARGE: 'PLT.FILE_TOO_LARGE',
  FILE_NOT_FOUND: 'PLT.FILE_NOT_FOUND',
  STORAGE_UNAVAILABLE: 'PLT.STORAGE_UNAVAILABLE',
} as const;

export type PlatformErrorCode =
  (typeof PLATFORM_ERROR_CODES)[keyof typeof PLATFORM_ERROR_CODES];

export const DEFAULT_MAX_UPLOAD_MB = 10;
export const SIGNED_URL_TTL_SECONDS = 900;

export const PLATFORM_AUDIT_ACTIONS = {
  numberAllocated: 'platform.number.allocate',
  fileUploaded: 'platform.file.upload',
} as const;

export const PLATFORM_ENTITY_TYPES = {
  numberingSeries: 'core_numbering_series',
  coreFile: 'core_file',
} as const;

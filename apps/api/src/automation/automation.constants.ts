export const AUTOMATION_ERROR_CODES = {
  NOT_FOUND: 'AUT.NOT_FOUND',
  VALIDATION: 'AUT.VALIDATION',
  INVALID_STATUS: 'AUT.INVALID_STATUS',
  FULL_AUTO_FORBIDDEN: 'AUT.FULL_AUTO_FORBIDDEN',
} as const;

export type AutomationErrorCode =
  (typeof AUTOMATION_ERROR_CODES)[keyof typeof AUTOMATION_ERROR_CODES];

export const AUTOMATION_EVENT_TYPES = {
  PROFILE_CHANGED: 'automation.profile.changed.v1',
  RUN_CREATED: 'automation.run.created.v1',
  RUN_REVIEWED: 'automation.run.reviewed.v1',
} as const;

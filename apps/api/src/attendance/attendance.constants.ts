export const ATTENDANCE_ERROR_CODES = {
  NOT_FOUND: 'ATT.NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'ATT.EMPLOYEE_NOT_FOUND',
  INVALID_DATES: 'ATT.INVALID_DATES',
  INVALID_STATUS: 'ATT.INVALID_STATUS',
  FORBIDDEN: 'ATT.FORBIDDEN',
  MOTIF_REQUIRED: 'ATT.MOTIF_REQUIRED',
} as const;

export type AttendanceErrorCode =
  (typeof ATTENDANCE_ERROR_CODES)[keyof typeof ATTENDANCE_ERROR_CODES];

export const ATTENDANCE_EVENT_TYPES = {
  ABSENCE_REQUESTED: 'attendance.absence.requested.v1',
  ABSENCE_APPROVED: 'attendance.absence.approved.v1',
  ABSENCE_REJECTED: 'attendance.absence.rejected.v1',
  ABSENCE_CANCELLED: 'attendance.absence.cancelled.v1',
  RH_EVENT_CREATED: 'attendance.rh_event.created.v1',
} as const;

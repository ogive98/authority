export const HR_ERROR_CODES = {
  NOT_FOUND: 'HR.NOT_FOUND',
  EMPLOYEE_NOT_FOUND: 'HR.EMPLOYEE_NOT_FOUND',
  CONTRACT_NOT_FOUND: 'HR.CONTRACT_NOT_FOUND',
  MATRICULE_EXISTS: 'HR.MATRICULE_EXISTS',
  INVALID_STATUS: 'HR.INVALID_STATUS',
  INVALID_DATES: 'HR.INVALID_DATES',
} as const;

export type HrErrorCode = (typeof HR_ERROR_CODES)[keyof typeof HR_ERROR_CODES];

export const HR_EVENT_TYPES = {
  EMPLOYEE_CREATED: 'hr.employee.created.v1',
  EMPLOYEE_UPDATED: 'hr.employee.updated.v1',
  CONTRACT_CREATED: 'hr.contract.created.v1',
  CONTRACT_ENDED: 'hr.contract.ended.v1',
} as const;

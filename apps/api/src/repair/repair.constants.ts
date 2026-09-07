export const REPAIR_ERROR_CODES = {
  NOT_FOUND: 'REP.NOT_FOUND',
  INVALID_DEPTH: 'REP.INVALID_DEPTH',
  INVALID_SCENARIO: 'REP.INVALID_SCENARIO',
  INVALID_SIGNATURE: 'REP.INVALID_SIGNATURE',
  RISK_BLOCKED: 'REP.RISK_BLOCKED',
  RISK_TOO_HIGH: 'REP.RISK_TOO_HIGH',
  CONFIRM_REQUIRED: 'REP.CONFIRM_REQUIRED',
  INVALID_STATUS: 'REP.INVALID_STATUS',
  EXECUTION_BLOCKED: 'REP.EXECUTION_BLOCKED',
  RESET_BLOCKED: 'REP.RESET_BLOCKED',
  INVALID_INPUT: 'REP.INVALID_INPUT',
} as const;

export type RepairErrorCode =
  (typeof REPAIR_ERROR_CODES)[keyof typeof REPAIR_ERROR_CODES];

export const REPAIR_EVENT_TYPES = {
  SCAN_STARTED: 'repair.scan.started.v1',
  SCAN_COMPLETED: 'repair.scan.completed.v1',
  FINDING_DETECTED: 'repair.finding.detected.v1',
  PLAN_CREATED: 'repair.plan.created.v1',
  STARTED: 'repair.started.v1',
  COMPLETED: 'repair.completed.v1',
  FAILED: 'repair.failed.v1',
  ROLLBACK_COMPLETED: 'repair.rollback.completed.v1',
  REPORT_QUEUED: 'repair.report.queued.v1',
} as const;

/** Pipeline stage ids — SCAN→…→REPORT (pack). */
export const REPAIR_PIPELINE_STAGES = [
  'SCAN',
  'FINDING',
  'SIGNATURE',
  'RECO',
  'RISK',
  'PLAN',
  'APPROVAL',
  'SNAPSHOT',
  'EXECUTE',
  'VERIFY',
  'ROLLBACK',
  'AUDIT',
  'REPORT',
] as const;

export type RepairPipelineStage = (typeof REPAIR_PIPELINE_STAGES)[number];

export const REPAIR_AGGREGATE_TYPES = {
  SCAN: 'rep_scan_execution',
  FINDING: 'rep_diagnostic_finding',
  EXECUTION: 'rep_repair_execution',
  RESET: 'rep_reset_execution',
  REPORT: 'rep_central_report',
} as const;

export const REPAIR_OUTBOX_LAG_MS = 5 * 60 * 1000;

export const EXECUTABLE_RISKS = new Set(['SAFE', 'LOW'] as const);

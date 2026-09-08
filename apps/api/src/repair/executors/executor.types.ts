export interface ExecutorDryRunResult {
  mode: 'dry-run';
  scenarioId: string;
  wouldApply: true;
  plannedActions: string[];
  note: string;
}

export interface ExecutorApplyResult {
  applied: true;
  scenarioId: string;
  actions: string[];
  sideEffects: string;
  details?: Record<string, unknown>;
}

export interface ExecutorVerifyContext {
  scenarioId: string;
  expected: string;
  applyResult?: Record<string, unknown> | null;
}

export interface ExecutorVerifyResult {
  ok: boolean;
  expected: string;
  checkedAt: string;
  mode: 'live' | 'stub';
  detail?: Record<string, unknown>;
  note?: string;
}

export interface RepairExecutor {
  scenarioIds: readonly string[];
  dryRun: (scenarioId: string) => Promise<ExecutorDryRunResult>;
  apply: (scenarioId: string) => Promise<ExecutorApplyResult>;
  verify: (ctx: ExecutorVerifyContext) => Promise<ExecutorVerifyResult>;
}

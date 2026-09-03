import {
  THUNDER_ERROR_CODES,
  type ThunderQueueFamily,
} from '../thunder.constants';

export const RULE_ACTION_WHITELIST = ['enqueue_job', 'notify'] as const;
export type RuleActionType = (typeof RULE_ACTION_WHITELIST)[number];

export type RuleNotifyChannel = 'ui' | 'email';

export type RuleAction =
  | {
      type: 'enqueue_job';
      jobType: string;
      queue: ThunderQueueFamily;
      /** Declared emit for cycle detection at save-time (Phase 1). */
      emitsEventType?: string;
    }
  | {
      type: 'notify';
      templateId: string;
      channel: RuleNotifyChannel;
    };

export interface ThunderRuleDefinition {
  id?: string;
  companyId?: string | null;
  moduleKey: string;
  name: string;
  enabled: boolean;
  priority: number;
  eventPattern: string;
  conditions: Record<string, unknown>;
  actions: RuleAction[];
}

export const RULE_EVAL_TIMEOUT_MS = 20;

export const THUNDER_RULE_ERROR_CODES = {
  INVALID_ACTION: THUNDER_ERROR_CODES.RULE_INVALID_ACTION,
  CYCLE_DETECTED: THUNDER_ERROR_CODES.RULE_CYCLE_DETECTED,
  EVAL_TIMEOUT: THUNDER_ERROR_CODES.RULE_EVAL_TIMEOUT,
  INVALID_LOGIC: THUNDER_ERROR_CODES.RULE_INVALID_LOGIC,
  NOT_FOUND: THUNDER_ERROR_CODES.RULE_NOT_FOUND,
} as const;

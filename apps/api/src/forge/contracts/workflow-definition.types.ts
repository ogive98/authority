/**
 * Abstract workflow contract — AUTHORITY uses automation ASSISTED (D245) today.
 * FORGE adapters may map to automation profiles in a later phase.
 */

export type WorkflowStepDefinition = {
  id: string;
  label?: Record<string, string>;
  permissionKey?: string;
  nextStepIds?: string[];
};

export type WorkflowDefinition = {
  id: string;
  key: string;
  version: string;
  trigger: string;
  steps: WorkflowStepDefinition[];
  permissions?: string[];
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
};

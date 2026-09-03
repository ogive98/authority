/**
 * Descriptive catalog metadata only.
 * Not the source of truth for company activation (ModModuleState),
 * licensing, permissions, runtime health, or business behavior.
 *
 * `commands` / `queries` are declarative labels — not a CommandBus/QueryBus.
 */

export interface CapabilityDef {
  key: string;
  moduleId: string;
  version: string;
  description?: string;
  permissionKey?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  requiresIdempotency?: boolean;
  requiresAudit?: boolean;
}

export interface ModuleCompatibility {
  minApiVersion?: string;
  maxApiVersion?: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  description?: string;
  capabilities: CapabilityDef[];
  /** Declarative metadata only — no bus execution in CAP-01. */
  commands?: string[];
  /** Declarative metadata only — no bus execution in CAP-01. */
  queries?: string[];
  publishedEvents?: string[];
  consumedEvents?: string[];
  permissions?: string[];
  /** Required peer module ids (catalog keys). */
  dependencies?: string[];
  optionalDependencies?: string[];
  settingsDefinitions?: Record<string, unknown>[];
  navigationEntries?: Record<string, unknown>[];
  dashboardWidgets?: Record<string, unknown>[];
  healthChecks?: string[];
  migrationsVersion?: string;
  compatibility?: ModuleCompatibility;
}

export const MODULE_MANIFEST_KEYS = [
  'id',
  'name',
  'version',
  'apiVersion',
  'description',
  'capabilities',
  'commands',
  'queries',
  'publishedEvents',
  'consumedEvents',
  'permissions',
  'dependencies',
  'optionalDependencies',
  'settingsDefinitions',
  'navigationEntries',
  'dashboardWidgets',
  'healthChecks',
  'migrationsVersion',
  'compatibility',
] as const;

export const CAPABILITY_DEF_KEYS = [
  'key',
  'moduleId',
  'version',
  'description',
  'permissionKey',
  'riskLevel',
  'timeoutMs',
  'requiresIdempotency',
  'requiresAudit',
] as const;

export const CAPABILITY_RISK_LEVELS = ['low', 'medium', 'high'] as const;

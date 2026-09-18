import type {
  FeatureFlagState,
  FeatureUiAxes,
} from './feature-ui-axes';

export type IndexEngineStatus = 'live' | 'partial' | 'deferred' | 'stub';

export type IndexRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type IndexModuleType = 'kernel' | 'official';

export type IndexedModule = {
  id: string;
  canonicalId: string;
  name: string;
  version: string;
  apiVersion: string;
  type: IndexModuleType;
  enabledByDefault: boolean;
  enabled: boolean;
  description: string | null;
  dependencies: string[];
  optionalDependencies: string[];
  capabilityCount: number;
  ui: { lazyLoad: boolean };
  ai: { discoverable: true; configurable: boolean };
};

export type IndexedFeature = {
  id: string;
  canonicalId: string;
  moduleId: string;
  label: string | null;
  href: string | null;
  flagKey: string | null;
  /** Runtime usable (module ∧ flag) — same as ui.enabled for boolean flags. */
  enabled: boolean;
  /** C16/D301 — pack axes derived from SOC-07; not a second store. */
  ui: FeatureUiAxes;
  /** Compact SOC-07 label: ON | OFF | HIDDEN (module off). */
  flagState: FeatureFlagState;
  ai: { discoverable: true };
};

export type IndexedCapability = {
  key: string;
  canonicalId: string;
  moduleId: string;
  version: string;
  description: string | null;
  permissionKey: string | null;
  riskLevel: IndexRiskLevel | null;
  enabled: boolean;
  ai: { discoverable: true };
};

export type IndexedEvent = {
  eventType: string;
  canonicalId: string;
  publisherModuleId: string;
  version: number;
  ai: { discoverable: true };
};

export type IndexedDependency = {
  moduleId: string;
  canonicalId: string;
  requires: string[];
  optional: string[];
};

export type IndexedCommand = {
  key: string;
  canonicalId: string;
  moduleId: string;
  ai: { discoverable: true };
};

export type IndexedQuery = {
  key: string;
  canonicalId: string;
  moduleId: string;
  ai: { discoverable: true };
};

export type IndexedConfiguration = {
  key: string;
  canonicalId: string;
  source: 'kernel' | 'company' | 'expertise' | 'secret';
  valueType: string;
  scope: 'system' | 'company' | 'site' | 'document' | 'user';
  risk: IndexRiskLevel;
  allowedValues: string[] | null;
  /** Discovery only — never the stored value. */
  secret: boolean;
  ai: { discoverable: true; configurable: boolean };
};

export type IndexedExtensionPoint = {
  id: string;
  canonicalId: string;
  moduleId: string;
  kind: 'hook.onRegister' | 'hook.onEnable' | 'hook.onDisable' | 'hook.health';
  description: string | null;
  ai: { discoverable: true; extensible: false };
};

export type AuthorityIndexSummary = {
  generatedAt: string;
  companyId: string | null;
  counts: {
    modules: number;
    features: number;
    capabilities: number;
    events: number;
    commands: number;
    queries: number;
    configuration: number;
    extensionPoints: number;
  };
  engines: Record<string, IndexEngineStatus>;
};

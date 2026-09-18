/**
 * C16 / D301 — pack UI axes derived from SOC-07 runtime.
 * Runtime SoT remains ModModuleState + ModFlag (boolean).
 * Never store a second feature-state model.
 */

export type FeatureUiAxes = {
  /** Module ENABLED for the company — feature may be turned on. */
  available: boolean;
  /** available ∧ flag ON (or no flagKey) — show in UI. */
  visible: boolean;
  /** Same as visible while ModFlag is boolean; reserved for READ_ONLY later. */
  enabled: boolean;
  /** Manifest `required: true` only — never invented. */
  required: boolean;
};

/** Compact SOC-07-shaped label for discovery (boolean flags only today). */
export type FeatureFlagState = 'ON' | 'OFF' | 'HIDDEN';

export function deriveFeatureUi(input: {
  moduleEnabled: boolean;
  flagOn: boolean;
  required?: boolean;
}): { ui: FeatureUiAxes; flagState: FeatureFlagState } {
  const required = input.required === true;
  if (!input.moduleEnabled) {
    return {
      flagState: 'HIDDEN',
      ui: {
        available: false,
        visible: false,
        enabled: false,
        required,
      },
    };
  }
  if (!input.flagOn) {
    return {
      flagState: 'OFF',
      ui: {
        available: true,
        visible: false,
        enabled: false,
        required,
      },
    };
  }
  return {
    flagState: 'ON',
    ui: {
      available: true,
      visible: true,
      enabled: true,
      required,
    },
  };
}

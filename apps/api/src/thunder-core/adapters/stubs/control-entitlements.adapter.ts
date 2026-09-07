import type { AdapterHealth, ThunderAdapter } from '../adapter.types';

/**
 * Stub Control↔Thunder entitlements connector.
 * No network — prepares terrain for CTRL-01.
 */
export class ControlEntitlementsAdapterStub implements ThunderAdapter {
  readonly manifest = {
    adapterId: 'control.entitlements',
    version: '0.1.0',
    direction: 'bidirectional' as const,
    capabilities: ['platform.capabilities.read'],
    dependencyKey: 'control_entitlements',
    description:
      'Stub adapter for signed entitlement snapshots (Control Plane later)',
  };

  async health(): Promise<AdapterHealth> {
    return {
      ok: true,
      message: 'control.entitlements stub — no remote Control yet',
      details: { mode: 'license-stub' },
    };
  }
}

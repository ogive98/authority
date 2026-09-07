import { AdapterRegistryService } from './adapter.registry';
import { ControlEntitlementsAdapterStub } from './stubs/control-entitlements.adapter';

describe('AdapterRegistryService', () => {
  it('registers and lists adapter manifests', async () => {
    const registry = new AdapterRegistryService();
    registry.register(new ControlEntitlementsAdapterStub());
    expect(registry.list().map((m) => m.adapterId)).toEqual([
      'control.entitlements',
    ]);
    const health = await registry.healthAll();
    expect(health[0]?.health.ok).toBe(true);
  });
});

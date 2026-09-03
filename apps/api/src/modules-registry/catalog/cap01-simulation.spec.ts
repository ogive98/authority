import { STATIC_MODULE_MANIFESTS } from './manifests';
import {
  assertCatalogIntegrity,
  assertModuleManifest,
} from './manifest.validator';
import { ModuleCatalogService } from './module-catalog.service';
import type { ModuleRegistryService } from '../module-registry.service';

/**
 * Pure ERP catalog stress simulations (no Nest HTTP).
 */
describe('CAP-01 catalog stress simulations', () => {
  it('static pack validates and covers exactly seeded keys', () => {
    const manifests = STATIC_MODULE_MANIFESTS.map((m) =>
      assertModuleManifest({ ...m }),
    );
    expect(() => assertCatalogIntegrity(manifests)).not.toThrow();
    expect(manifests).toHaveLength(11);
  });

  it('rejects injecting a 12th module without dropping coverage rule', () => {
    const modules = {
      isEnabled: jest.fn(),
    };
    const catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();

    expect(() =>
      catalog.load([
        ...STATIC_MODULE_MANIFESTS,
        {
          id: 'fleet',
          name: 'Fleet',
          version: '1.0.0',
          apiVersion: '1',
          capabilities: [
            { key: 'fleet.discover', moduleId: 'fleet', version: '1' },
          ],
        },
      ]),
    ).toThrow(/exactly 11/);
  });

  it('detects dependency cycle candidates among the 11 (none expected)', () => {
    const byId = new Map(
      STATIC_MODULE_MANIFESTS.map((m) => [m.id, m] as const),
    );

    function hasCycle(start: string): boolean {
      const stack = new Set<string>();
      const visiting = new Set<string>();

      function dfs(id: string): boolean {
        if (stack.has(id)) {
          return true;
        }
        if (visiting.has(id)) {
          return false;
        }
        visiting.add(id);
        stack.add(id);
        const deps = byId.get(id)?.dependencies ?? [];
        for (const dep of deps) {
          if (dfs(dep)) {
            return true;
          }
        }
        stack.delete(id);
        return false;
      }

      return dfs(start);
    }

    for (const id of byId.keys()) {
      expect(hasCycle(id)).toBe(false);
    }
  });

  it('listEffectiveCapabilities uses one listStates (no N+1) and ignores DISABLED', async () => {
    const modules = {
      isEnabled: jest.fn(),
      listStates: jest.fn().mockResolvedValue([
        { moduleKey: 'platform', status: 'ENABLED' },
        { moduleKey: 'settings', status: 'ENABLED' },
        { moduleKey: 'sales', status: 'DISABLED' },
      ]),
    };
    const catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();

    const caps = await catalog.listEffectiveCapabilities('co-1');
    expect(modules.listStates).toHaveBeenCalledTimes(1);
    expect(modules.isEnabled).not.toHaveBeenCalled();
    expect(
      caps.every((c) => c.moduleId === 'platform' || c.moduleId === 'settings'),
    ).toBe(true);
    expect(caps.some((c) => c.moduleId === 'sales')).toBe(false);
  });
});

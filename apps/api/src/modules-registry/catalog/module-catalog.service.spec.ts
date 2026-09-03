import { ModModuleStatus } from '@prisma/client';
import { ModuleRegistryService } from '../module-registry.service';
import { ModuleCatalogService } from './module-catalog.service';
import { STATIC_MODULE_MANIFESTS } from './manifests';
import { CatalogValidationError } from './manifest.validator';

describe('ModuleCatalogService', () => {
  let modules: { isEnabled: jest.Mock; listStates: jest.Mock };
  let catalog: ModuleCatalogService;

  beforeEach(() => {
    modules = { isEnabled: jest.fn(), listStates: jest.fn() };
    catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();
  });

  it('loads exactly 11 seeded manifests', () => {
    expect(catalog.list()).toHaveLength(11);
    expect(STATIC_MODULE_MANIFESTS).toHaveLength(11);
  });

  it('resolves getByKey and capabilitiesFor', () => {
    const sales = catalog.getByKey('sales');
    expect(sales?.name).toBe('Sales');
    expect(catalog.capabilitiesFor('sales').map((c) => c.key)).toContain(
      'sales.ping',
    );
  });

  it('indexes capabilities by key', () => {
    expect(catalog.getCapability('inventory.job.gated')?.moduleId).toBe(
      'inventory',
    );
  });

  it('listEffectiveCapabilities intersects catalog with ENABLED state', async () => {
    modules.listStates.mockResolvedValue([
      { moduleKey: 'platform', status: 'ENABLED' },
      { moduleKey: 'identity', status: 'ENABLED' },
      { moduleKey: 'sales', status: 'DISABLED' },
    ]);

    const caps = await catalog.listEffectiveCapabilities('company-demo');
    const keys = caps.map((c) => c.key);
    expect(keys).toContain('platform.modules.read');
    expect(keys).toContain('identity.session.read');
    expect(keys).not.toContain('sales.ping');
    expect(keys).not.toContain('inventory.job.gated');
  });

  it('treats DISABLED module as zero capabilities for that module', async () => {
    modules.listStates.mockResolvedValue([
      { moduleKey: 'sales', status: 'DISABLED' },
    ]);
    await expect(
      catalog.listEffectiveCapabilities('company-demo'),
    ).resolves.toEqual([]);
  });

  it('rejects catalog that omits a seeded key', () => {
    expect(() =>
      catalog.load(STATIC_MODULE_MANIFESTS.filter((m) => m.id !== 'payroll')),
    ).toThrow(CatalogValidationError);
  });
});

describe('ModuleCatalogService activation authority', () => {
  it('does not treat catalog presence as ENABLED', async () => {
    const modules = {
      isEnabled: jest.fn(),
      listStates: jest
        .fn()
        .mockResolvedValue([
          { moduleKey: 'sales', status: ModModuleStatus.DISABLED },
        ]),
    };
    const catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();

    expect(catalog.getByKey('sales')).toBeDefined();
    const caps = await catalog.listEffectiveCapabilities('company-demo');
    expect(caps.find((c) => c.moduleId === 'sales')).toBeUndefined();
    expect(modules.listStates).toHaveBeenCalledWith('company-demo');
    expect(ModModuleStatus.ENABLED).toBe('ENABLED');
    expect(ModModuleStatus.DISABLED).toBe('DISABLED');
  });
});

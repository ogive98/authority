import { ModModuleStatus } from '@prisma/client';
import { ModuleCatalogService } from './module-catalog.service';
import { ModuleLifecycleService } from './module-lifecycle.service';
import { STATIC_MODULE_MANIFESTS } from './manifests';
import type { ModuleRegistryService } from '../module-registry.service';

describe('ModuleLifecycleService', () => {
  function build(listStates?: jest.Mock) {
    const modules = {
      isEnabled: jest.fn(),
      listStates: listStates ?? jest.fn().mockResolvedValue([]),
    };
    const catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();
    const lifecycle = new ModuleLifecycleService(
      catalog,
      modules as unknown as ModuleRegistryService,
    );
    lifecycle.onModuleInit();
    return { catalog, modules, lifecycle };
  }

  it('boots all 13 seeded modules to READY (deps present in catalog)', () => {
    const { lifecycle } = build();
    const states = lifecycle.listProcessStates();
    expect(states).toHaveLength(13);
    expect(states.every((s) => s.state === 'READY')).toBe(true);
  });

  it('marks process ERROR when required dependency missing from catalog', () => {
    const modules = {
      isEnabled: jest.fn(),
      listStates: jest.fn().mockResolvedValue([]),
    };
    // Load minimal broken catalog via stub — bypass assertSeededCoverage
    const stubCatalog = {
      list: () => [
        {
          id: 'platform',
          name: 'Platform',
          version: '1',
          apiVersion: '1',
          capabilities: [],
          dependencies: [],
        },
        {
          id: 'sales',
          name: 'Sales',
          version: '1',
          apiVersion: '1',
          capabilities: [],
          dependencies: ['ghost'],
        },
      ],
      getByKey: (id: string) =>
        id === 'sales'
          ? {
              id: 'sales',
              name: 'Sales',
              version: '1',
              apiVersion: '1',
              capabilities: [],
              dependencies: ['ghost'],
            }
          : id === 'platform'
            ? {
                id: 'platform',
                name: 'Platform',
                version: '1',
                apiVersion: '1',
                capabilities: [],
              }
            : undefined,
    };
    const lifecycle = new ModuleLifecycleService(
      stubCatalog as unknown as ModuleCatalogService,
      modules as unknown as ModuleRegistryService,
    );
    lifecycle.recomputeProcessLifecycle();
    expect(lifecycle.getProcessState('sales')?.state).toBe('ERROR');
    expect(lifecycle.getProcessState('platform')?.state).toBe('READY');
  });

  it('marks process DEGRADED when optional dependency missing from catalog', () => {
    const modules = {
      isEnabled: jest.fn(),
      listStates: jest.fn(),
    };
    const stubCatalog = {
      list: () => [
        {
          id: 'platform',
          name: 'Platform',
          version: '1',
          apiVersion: '1',
          capabilities: [],
        },
        {
          id: 'sales',
          name: 'Sales',
          version: '1',
          apiVersion: '1',
          capabilities: [],
          optionalDependencies: ['ghost_opt'],
        },
      ],
      getByKey: (id: string) => stubCatalog.list().find((m) => m.id === id),
    };
    const lifecycle = new ModuleLifecycleService(
      stubCatalog as unknown as ModuleCatalogService,
      modules as unknown as ModuleRegistryService,
    );
    lifecycle.recomputeProcessLifecycle();
    expect(lifecycle.getProcessState('sales')?.state).toBe('DEGRADED');
  });

  it('company health INACTIVE when DISABLED', async () => {
    const { lifecycle, modules } = build(
      jest
        .fn()
        .mockResolvedValue([
          { moduleKey: 'sales', status: ModModuleStatus.DISABLED },
        ]),
    );
    const health = await lifecycle.evaluateCompanyHealth('co', 'sales');
    expect(health.health).toBe('INACTIVE');
    expect(health.activation).toBe('DISABLED');
    expect(modules.listStates).toHaveBeenCalledWith('co');
  });

  it('company health BLOCKED when ENABLED but required deps DISABLED', async () => {
    const { lifecycle } = build(
      jest.fn().mockResolvedValue([
        { moduleKey: 'sales', status: ModModuleStatus.ENABLED },
        { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
        { moduleKey: 'organization', status: ModModuleStatus.ENABLED },
        { moduleKey: 'customers', status: ModModuleStatus.DISABLED },
        { moduleKey: 'inventory', status: ModModuleStatus.DISABLED },
      ]),
    );
    const health = await lifecycle.evaluateCompanyHealth('co', 'sales');
    expect(health.health).toBe('BLOCKED');
    expect(health.missingRequiredDependencies).toEqual(
      expect.arrayContaining(['customers', 'inventory']),
    );
  });

  it('company health DEGRADED when optional deps missing', async () => {
    const { lifecycle } = build(
      jest.fn().mockResolvedValue([
        { moduleKey: 'sales', status: ModModuleStatus.ENABLED },
        { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
        { moduleKey: 'organization', status: ModModuleStatus.ENABLED },
        { moduleKey: 'customers', status: ModModuleStatus.ENABLED },
        { moduleKey: 'inventory', status: ModModuleStatus.ENABLED },
        { moduleKey: 'products', status: ModModuleStatus.ENABLED },
        { moduleKey: 'master_data', status: ModModuleStatus.DISABLED },
      ]),
    );
    const health = await lifecycle.evaluateCompanyHealth('co', 'sales');
    expect(health.health).toBe('DEGRADED');
    expect(health.missingOptionalDependencies).toContain('master_data');
  });

  it('company health READY when required+optional deps ENABLED', async () => {
    const { lifecycle } = build(
      jest.fn().mockResolvedValue([
        { moduleKey: 'sales', status: ModModuleStatus.ENABLED },
        { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
        { moduleKey: 'organization', status: ModModuleStatus.ENABLED },
        { moduleKey: 'customers', status: ModModuleStatus.ENABLED },
        { moduleKey: 'inventory', status: ModModuleStatus.ENABLED },
        { moduleKey: 'products', status: ModModuleStatus.ENABLED },
        { moduleKey: 'master_data', status: ModModuleStatus.ENABLED },
      ]),
    );
    const health = await lifecycle.evaluateCompanyHealth('co', 'sales');
    expect(health).toMatchObject({ health: 'READY', activation: 'ENABLED' });
  });

  it('canEnable is false when required deps not ENABLED', async () => {
    const { lifecycle } = build(
      jest
        .fn()
        .mockResolvedValue([
          { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
        ]),
    );
    const result = await lifecycle.canEnable('co', 'sales');
    expect(result.ok).toBe(false);
    expect(result.missingRequiredDependencies).toEqual(
      expect.arrayContaining(['organization', 'customers', 'inventory']),
    );
  });

  it('static catalog has no process ERROR modules', () => {
    expect(STATIC_MODULE_MANIFESTS).toHaveLength(13);
    const { lifecycle } = build();
    expect(
      lifecycle.listProcessStates().filter((s) => s.state === 'ERROR'),
    ).toHaveLength(0);
  });
});

import { ModModuleStatus } from '@prisma/client';
import { FeatureFlagService } from '../feature-flag.service';
import { ModuleRegistryService } from '../module-registry.service';
import { FLAG_KEYS } from '../modules.constants';
import { AuthorityIndexService } from './authority-index.service';
import { ModuleCatalogService } from './module-catalog.service';
import { ModuleHookRegistry } from './module-hook.registry';

describe('AuthorityIndexService', () => {
  let modules: { resolveCompanyId: jest.Mock; listStates: jest.Mock };
  let flags: { listFlags: jest.Mock };
  let hooks: ModuleHookRegistry;
  let catalog: ModuleCatalogService;
  let index: AuthorityIndexService;

  beforeEach(() => {
    modules = {
      resolveCompanyId: jest.fn().mockResolvedValue('company-a'),
      listStates: jest.fn().mockResolvedValue([
        { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
        { moduleKey: 'sales', status: ModModuleStatus.DISABLED },
        { moduleKey: 'identity', status: ModModuleStatus.ENABLED },
      ]),
    };
    flags = {
      listFlags: jest
        .fn()
        .mockResolvedValue([
          { flagKey: FLAG_KEYS.platformSearch, enabled: true },
        ]),
    };
    catalog = new ModuleCatalogService(
      modules as unknown as ModuleRegistryService,
    );
    catalog.onModuleInit();
    hooks = new ModuleHookRegistry();
    hooks.register('sales', {
      contribution: {
        moduleKey: 'sales',
        description: 'Sales runtime hooks',
        healthCheckIds: ['sales.health'],
      },
    });
    index = new AuthorityIndexService(
      catalog,
      modules as unknown as ModuleRegistryService,
      flags as unknown as FeatureFlagService,
      hooks,
    );
  });

  it('aliases existing module keys without replacing them', async () => {
    const listed = await index.modules('user-1', {}, {});
    const sales = listed.find((row) => row.id === 'sales');
    expect(sales?.canonicalId).toBe('mod.sales');
    expect(sales?.type).toBe('official');
    expect(sales?.enabled).toBe(false);
    expect(sales?.ui.lazyLoad).toBe(true);
    const platform = listed.find((row) => row.id === 'platform');
    expect(platform?.type).toBe('kernel');
    expect(platform?.enabled).toBe(true);
    expect(platform?.enabledByDefault).toBe(true);
  });

  it('keeps disabled capabilities discoverable', async () => {
    const caps = await index.capabilities('user-1', {}, {});
    const confirm = caps.find((row) => row.key === 'sales.confirm');
    expect(confirm?.canonicalId).toBe('cap.sales.confirm');
    expect(confirm?.enabled).toBe(false);
    expect(confirm?.riskLevel).toBe('high');
  });

  it('indexes events, commands and configuration from existing catalogs', async () => {
    const events = index.listEvents();
    expect(
      events.some((row) => row.eventType === 'sales.order.created.v1'),
    ).toBe(true);
    expect(
      events.find((row) => row.eventType === 'sales.order.created.v1')
        ?.canonicalId,
    ).toBe('event.sales.order.created');

    expect(
      index.listCommands().some((row) => row.key === 'sales.order.create'),
    ).toBe(true);

    expect(
      events.some((row) => row.eventType === 'backup.requested.v1'),
    ).toBe(true);
    expect(
      index.listCommands().some((row) => row.key === 'backup.create'),
    ).toBe(true);

    const vat = index.listConfiguration().find((row) => row.key === 'tax.vat');
    expect(vat?.risk).toBe('critical');
    expect(vat).not.toHaveProperty('value');

    const points = index.listExtensionPoints();
    expect(points.some((row) => row.id === 'sales.hooks')).toBe(true);
    expect(points.some((row) => row.id === 'sales.health')).toBe(true);

    const summary = await index.summary('user-1', {}, {});
    expect(summary.companyId).toBe('company-a');
    expect(summary.engines.workflowEngine).toBe('deferred');
    expect(summary.engines.aiGateway).toBe('stub');
    expect(summary.counts.modules).toBe(28);
  });

  it('does not treat catalog presence as tenant enablement', async () => {
    modules.listStates.mockResolvedValue([
      { moduleKey: 'sales', status: ModModuleStatus.DISABLED },
    ]);
    const features = await index.features('user-1', {}, {});
    const orders = features.find((row) => row.id === 'sales.orders');
    expect(orders?.canonicalId).toBe('feat.sales.orders');
    expect(orders?.enabled).toBe(false);
    expect(orders?.flagState).toBe('HIDDEN');
    expect(orders?.ui).toEqual({
      available: false,
      visible: false,
      enabled: false,
      required: false,
    });
  });

  it('maps SOC-07 flag OFF to pack axes available+invisible (C16)', async () => {
    modules.listStates.mockResolvedValue([
      { moduleKey: 'platform', status: ModModuleStatus.ENABLED },
    ]);
    flags.listFlags.mockResolvedValue([
      { flagKey: FLAG_KEYS.platformSearch, enabled: false },
    ]);
    const features = await index.features('user-1', {}, {});
    const search = features.find((row) => row.id === 'platform.search');
    expect(search?.flagState).toBe('OFF');
    expect(search?.ui).toEqual({
      available: true,
      visible: false,
      enabled: false,
      required: false,
    });
    expect(search?.enabled).toBe(false);
  });
});

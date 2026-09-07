import { ModuleHookRegistry } from './module-hook.registry';

describe('ModuleHookRegistry', () => {
  let registry: ModuleHookRegistry;

  beforeEach(() => {
    registry = new ModuleHookRegistry();
  });

  it('merges contributions for the same moduleKey', () => {
    registry.register('sales', {
      contribution: {
        moduleKey: 'sales',
        consumers: ['sales.tap'],
        jobTypes: ['sales.confirm.v1'],
      },
    });
    registry.register('sales', {
      contribution: {
        moduleKey: 'sales',
        consumers: ['thunder.intel'],
        healthCheckIds: ['sales.ready'],
      },
    });

    const contrib = registry.listContributions().find((c) => c.moduleKey === 'sales');
    expect(contrib?.consumers).toEqual(
      expect.arrayContaining(['sales.tap', 'thunder.intel']),
    );
    expect(contrib?.jobTypes).toEqual(['sales.confirm.v1']);
    expect(contrib?.healthCheckIds).toEqual(['sales.ready']);
  });

  it('runs onEnable / onDisable hooks', async () => {
    const enable = jest.fn();
    const disable = jest.fn();
    registry.register('delivery', {
      onEnable: enable,
      onDisable: disable,
      contribution: { moduleKey: 'delivery', consumers: ['thunder.intel'] },
    });

    await registry.runEnable({
      companyId: 'co-1',
      moduleKey: 'delivery',
    });
    await registry.runDisable({
      companyId: 'co-1',
      moduleKey: 'delivery',
    });

    expect(enable).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'co-1', moduleKey: 'delivery' }),
    );
    expect(disable).toHaveBeenCalled();
    expect(registry.listLastRuns().map((r) => r.action)).toEqual([
      'enable',
      'disable',
    ]);
  });

  it('runs onRegister once', async () => {
    const onRegister = jest.fn();
    registry.register('platform', { onRegister });
    await registry.runRegisterAll();
    await registry.runRegisterAll();
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it('aggregates health checks', async () => {
    registry.register('finance', {
      healthChecks: [
        () => ({ ok: true, checkId: 'finance.ledger' }),
        () => ({ ok: false, checkId: 'finance.outbox', message: 'lag' }),
      ],
    });
    const results = await registry.runHealthChecks('finance');
    expect(results).toHaveLength(2);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });
});

import { MeRegistryService } from './me-registry.service';

describe('MeRegistryService', () => {
  function createService(opts: {
    companyId: string | null;
    states: { moduleKey: string; status: string }[];
    flags: { flagKey: string; enabled: boolean }[];
    manifests?: Record<
      string,
      { name: string; navigationEntries?: Record<string, unknown>[] }
    >;
  }) {
    const moduleRegistry = {
      resolveCompanyId: jest.fn().mockResolvedValue(opts.companyId),
      listStates: jest.fn().mockResolvedValue(opts.states),
    };
    const catalog = {
      getByKey: jest.fn(
        (key: string) => opts.manifests?.[key] ?? { name: key },
      ),
    };
    const flags = {
      listFlags: jest.fn().mockResolvedValue(opts.flags),
    };
    const permissions = {
      evaluate: jest.fn().mockResolvedValue(true),
    };
    return new MeRegistryService(
      moduleRegistry as never,
      catalog as never,
      flags as never,
      permissions as never,
    );
  }

  it('always includes home and omits DISABLED modules', async () => {
    const svc = createService({
      companyId: 'co-1',
      states: [
        { moduleKey: 'settings', status: 'ENABLED' },
        { moduleKey: 'sales', status: 'DISABLED' },
      ],
      flags: [],
    });

    const res = await svc.buildForUser('u1', {}, {});
    expect(res.modules.map((m) => m.key)).toEqual(['home', 'settings']);
    expect(res.modules.find((m) => m.key === 'sales')).toBeUndefined();
  });

  it('hides flag-gated feature when flag is off', async () => {
    const svc = createService({
      companyId: 'co-1',
      states: [{ moduleKey: 'platform', status: 'ENABLED' }],
      flags: [{ flagKey: 'platform.search', enabled: false }],
      manifests: {
        platform: {
          name: 'Platform',
          navigationEntries: [
            { id: 'platform-overview', label: 'Platform', href: '/m/platform' },
            {
              id: 'platform-search',
              label: 'Recherche',
              href: '/search',
              flagKey: 'platform.search',
            },
          ],
        },
      },
    });

    const res = await svc.buildForUser('u1', {}, {});
    const platform = res.modules.find((m) => m.key === 'platform');
    expect(platform?.features.map((f) => f.id)).not.toContain(
      'platform-search',
    );
  });

  it('shows flag-gated feature when flag is on', async () => {
    const svc = createService({
      companyId: 'co-1',
      states: [{ moduleKey: 'platform', status: 'ENABLED' }],
      flags: [{ flagKey: 'platform.search', enabled: true }],
      manifests: {
        platform: {
          name: 'Platform',
          navigationEntries: [
            { id: 'platform-overview', label: 'Platform', href: '/m/platform' },
            {
              id: 'platform-search',
              label: 'Recherche',
              href: '/search',
              flagKey: 'platform.search',
            },
          ],
        },
      },
    });

    const res = await svc.buildForUser('u1', {}, {});
    const platform = res.modules.find((m) => m.key === 'platform');
    expect(platform?.features.some((f) => f.id === 'platform-search')).toBe(
      true,
    );
  });

  it('never includes super-admin', async () => {
    const svc = createService({
      companyId: 'co-1',
      states: [
        { moduleKey: 'super-admin', status: 'ENABLED' },
        { moduleKey: 'settings', status: 'ENABLED' },
      ],
      flags: [],
    });

    const res = await svc.buildForUser('u1', {}, {});
    expect(res.modules.map((m) => m.key)).not.toContain('super-admin');
  });

  it('hides nav apps when permissionKey is denied', async () => {
    const moduleRegistry = {
      resolveCompanyId: jest.fn().mockResolvedValue('co-1'),
      listStates: jest
        .fn()
        .mockResolvedValue([{ moduleKey: 'identity', status: 'ENABLED' }]),
    };
    const catalog = {
      getByKey: jest.fn(() => ({
        name: 'Identité',
        navigationEntries: [
          { id: 'account', label: 'Mon compte', href: '/account' },
          {
            id: 'users',
            label: 'Utilisateurs',
            href: '/users',
            permissionKey: 'identity.user.manage',
          },
        ],
      })),
    };
    const flags = { listFlags: jest.fn().mockResolvedValue([]) };
    const permissions = {
      evaluate: jest.fn(async (_u: string, key: string) => {
        return key !== 'identity.user.manage';
      }),
    };
    const svc = new MeRegistryService(
      moduleRegistry as never,
      catalog as never,
      flags as never,
      permissions as never,
    );

    const res = await svc.buildForUser('u1', {}, {});
    const identity = res.modules.find((m) => m.key === 'identity');
    expect(identity?.features.map((f) => f.id)).toEqual(['account']);
  });
});

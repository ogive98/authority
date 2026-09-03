import {
  assertCatalogIntegrity,
  assertModuleManifest,
  CatalogValidationError,
  CATALOG_ERROR_CODES,
} from './manifest.validator';
import type { ModuleManifest } from './manifest.types';

function baseManifest(
  overrides: Partial<ModuleManifest> & { id: string },
): Record<string, unknown> {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    version: overrides.version ?? '1.0.0',
    apiVersion: overrides.apiVersion ?? '1',
    capabilities: overrides.capabilities ?? [
      {
        key: `${overrides.id}.discover`,
        moduleId: overrides.id,
        version: '1',
      },
    ],
    ...Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== 'id'),
    ),
  };
}

describe('assertModuleManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const manifest = assertModuleManifest(baseManifest({ id: 'platform' }));
    expect(manifest.id).toBe('platform');
    expect(manifest.capabilities).toHaveLength(1);
  });

  it('rejects unknown properties (whitelist)', () => {
    expect(() =>
      assertModuleManifest({
        ...baseManifest({ id: 'platform' }),
        secretHook: true,
      }),
    ).toThrow(CatalogValidationError);
    try {
      assertModuleManifest({
        ...baseManifest({ id: 'platform' }),
        secretHook: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogValidationError);
      expect((error as CatalogValidationError).code).toBe(
        CATALOG_ERROR_CODES.INVALID_MANIFEST,
      );
      expect((error as Error).message).toContain('secretHook');
    }
  });

  it('rejects capability with unknown property', () => {
    expect(() =>
      assertModuleManifest({
        id: 'sales',
        name: 'Sales',
        version: '1.0.0',
        apiVersion: '1',
        capabilities: [
          {
            key: 'sales.ping',
            moduleId: 'sales',
            version: '1',
            handlerClass: 'SalesService',
          },
        ],
      }),
    ).toThrow(/handlerClass/);
  });

  it('rejects capability moduleId mismatch', () => {
    expect(() =>
      assertModuleManifest({
        id: 'sales',
        name: 'Sales',
        version: '1.0.0',
        apiVersion: '1',
        capabilities: [
          { key: 'sales.ping', moduleId: 'inventory', version: '1' },
        ],
      }),
    ).toThrow(/moduleId must equal manifest id/);
  });

  it('rejects invalid capability key format', () => {
    expect(() =>
      assertModuleManifest({
        id: 'sales',
        name: 'Sales',
        version: '1.0.0',
        apiVersion: '1',
        capabilities: [{ key: 'SalesPing', moduleId: 'sales', version: '1' }],
      }),
    ).toThrow(/dotted lowercase/);
  });

  it('rejects non-object input', () => {
    expect(() => assertModuleManifest('evil')).toThrow(/plain object/);
    expect(() => assertModuleManifest(null)).toThrow(/plain object/);
  });

  it('keeps commands and queries as metadata arrays', () => {
    const manifest = assertModuleManifest({
      id: 'sales',
      name: 'Sales',
      version: '1.0.0',
      apiVersion: '1',
      capabilities: [{ key: 'sales.ping', moduleId: 'sales', version: '1' }],
      commands: ['sales.createOrder'],
      queries: ['sales.ping'],
    });
    expect(manifest.commands).toEqual(['sales.createOrder']);
    expect(manifest.queries).toEqual(['sales.ping']);
  });
});

describe('assertCatalogIntegrity', () => {
  it('rejects duplicate module ids', () => {
    const a = assertModuleManifest(baseManifest({ id: 'platform' }));
    const b = assertModuleManifest(baseManifest({ id: 'platform' }));
    expect(() => assertCatalogIntegrity([a, b])).toThrow(/Duplicate module id/);
  });

  it('rejects duplicate capability keys across modules', () => {
    const a = assertModuleManifest({
      id: 'platform',
      name: 'Platform',
      version: '1.0.0',
      apiVersion: '1',
      capabilities: [{ key: 'shared.cap', moduleId: 'platform', version: '1' }],
    });
    const b = assertModuleManifest({
      id: 'identity',
      name: 'Identity',
      version: '1.0.0',
      apiVersion: '1',
      capabilities: [{ key: 'shared.cap', moduleId: 'identity', version: '1' }],
    });
    expect(() => assertCatalogIntegrity([a, b])).toThrow(
      /Duplicate capability key/,
    );
  });

  it('rejects unknown required dependency', () => {
    const a = assertModuleManifest({
      id: 'sales',
      name: 'Sales',
      version: '1.0.0',
      apiVersion: '1',
      capabilities: [{ key: 'sales.ping', moduleId: 'sales', version: '1' }],
      dependencies: ['does_not_exist'],
    });
    expect(() => assertCatalogIntegrity([a])).toThrow(/unknown module/);
  });

  it('accepts optional dependency that exists', () => {
    const platform = assertModuleManifest(baseManifest({ id: 'platform' }));
    const sales = assertModuleManifest({
      id: 'sales',
      name: 'Sales',
      version: '1.0.0',
      apiVersion: '1',
      capabilities: [{ key: 'sales.ping', moduleId: 'sales', version: '1' }],
      optionalDependencies: ['platform'],
    });
    expect(() => assertCatalogIntegrity([platform, sales])).not.toThrow();
  });
});

import { CAPABILITY_ERROR_CODES } from '../modules.constants';
import { CapabilityResolverService } from './capability-resolver.service';
import type { ModuleCatalogService } from './module-catalog.service';
import type { ModuleRegistryService } from '../module-registry.service';
import type { PermissionService } from '../../permissions/permission.service';

describe('CapabilityResolverService', () => {
  const companyId = 'company-demo';
  const userId = 'user-1';

  let catalog: {
    getCapability: jest.Mock;
    getByKey: jest.Mock;
  };
  let modules: { isEnabled: jest.Mock };
  let permissions: { evaluate: jest.Mock };
  let resolver: CapabilityResolverService;

  beforeEach(() => {
    catalog = {
      getCapability: jest.fn(),
      getByKey: jest.fn(),
    };
    modules = { isEnabled: jest.fn() };
    permissions = { evaluate: jest.fn() };
    resolver = new CapabilityResolverService(
      catalog as unknown as ModuleCatalogService,
      modules as unknown as ModuleRegistryService,
      permissions as unknown as PermissionService,
    );
  });

  it('denies unknown capability', async () => {
    catalog.getCapability.mockReturnValue(undefined);
    const result = await resolver.resolve('ghost.action', {
      companyId,
      userId,
    });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.UNKNOWN,
    });
    expect(modules.isEnabled).not.toHaveBeenCalled();
  });

  it('denies when module is not registered in catalog', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'sales.ping',
      moduleId: 'sales',
      version: '1',
    });
    catalog.getByKey.mockReturnValue(undefined);
    const result = await resolver.resolve('sales.ping', { companyId, userId });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.MODULE_UNREGISTERED,
      moduleId: 'sales',
    });
  });

  it('denies when module is DISABLED', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'sales.ping',
      moduleId: 'sales',
      version: '1',
    });
    catalog.getByKey.mockReturnValue({ id: 'sales' });
    modules.isEnabled.mockResolvedValue(false);
    const result = await resolver.resolve('sales.ping', { companyId, userId });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.MODULE_DISABLED,
    });
  });

  it('allows when registered, ENABLED, and no permissionKey (license stub OK)', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'sales.ping',
      moduleId: 'sales',
      version: '1',
    });
    catalog.getByKey.mockReturnValue({ id: 'sales' });
    modules.isEnabled.mockResolvedValue(true);
    const result = await resolver.resolve('sales.ping', { companyId, userId });
    expect(result).toEqual({
      allowed: true,
      capabilityKey: 'sales.ping',
      moduleId: 'sales',
    });
    expect(permissions.evaluate).not.toHaveBeenCalled();
  });

  it('checks permissionKey when present and denies if missing grant', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
      version: '1',
      permissionKey: 'system_monitoring.view',
    });
    catalog.getByKey.mockReturnValue({ id: 'monitoring' });
    modules.isEnabled.mockResolvedValue(true);
    permissions.evaluate.mockResolvedValue(false);

    const result = await resolver.resolve('monitoring.snapshot.read', {
      companyId,
      userId,
    });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
    });
    expect(permissions.evaluate).toHaveBeenCalledWith(
      userId,
      'system_monitoring.view',
      { companyId, siteId: undefined },
    );
  });

  it('allows when permissionKey grant is present', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
      version: '1',
      permissionKey: 'system_monitoring.view',
    });
    catalog.getByKey.mockReturnValue({ id: 'monitoring' });
    modules.isEnabled.mockResolvedValue(true);
    permissions.evaluate.mockResolvedValue(true);

    await expect(
      resolver.resolve('monitoring.snapshot.read', { companyId, userId }),
    ).resolves.toEqual({
      allowed: true,
      capabilityKey: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
    });
  });

  it('denies permission-gated capability without userId', async () => {
    catalog.getCapability.mockReturnValue({
      key: 'monitoring.snapshot.read',
      moduleId: 'monitoring',
      version: '1',
      permissionKey: 'system_monitoring.view',
    });
    catalog.getByKey.mockReturnValue({ id: 'monitoring' });
    modules.isEnabled.mockResolvedValue(true);

    const result = await resolver.resolve('monitoring.snapshot.read', {
      companyId,
    });
    expect(result).toMatchObject({
      allowed: false,
      code: CAPABILITY_ERROR_CODES.PERMISSION_DENIED,
    });
    expect(permissions.evaluate).not.toHaveBeenCalled();
  });
});

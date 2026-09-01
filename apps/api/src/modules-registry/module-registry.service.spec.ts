import { ModModuleStatus } from '@prisma/client';
import { FeatureFlagService } from './feature-flag.service';
import { ModuleRegistryService } from './module-registry.service';
import { FLAG_KEYS } from './modules.constants';

describe('ModuleRegistryService', () => {
  const companyId = 'company-demo';
  let prisma: {
    modModuleState: { findUnique: jest.Mock; findMany: jest.Mock };
    orgUserAssignment: { findFirst: jest.Mock };
  };
  let service: ModuleRegistryService;

  beforeEach(() => {
    prisma = {
      modModuleState: { findUnique: jest.fn(), findMany: jest.fn() },
      orgUserAssignment: { findFirst: jest.fn() },
    };
    service = new ModuleRegistryService(prisma as never);
  });

  it('treats a missing module row as DISABLED', async () => {
    prisma.modModuleState.findUnique.mockResolvedValue(null);
    await expect(service.isEnabled(companyId, 'sales')).resolves.toBe(false);
  });

  it('returns true only when status is ENABLED', async () => {
    prisma.modModuleState.findUnique.mockResolvedValue({
      status: ModModuleStatus.ENABLED,
    });
    await expect(service.isEnabled(companyId, 'identity')).resolves.toBe(true);

    prisma.modModuleState.findUnique.mockResolvedValue({
      status: ModModuleStatus.DISABLED,
    });
    await expect(service.isEnabled(companyId, 'sales')).resolves.toBe(false);
  });
});

describe('FeatureFlagService', () => {
  const companyId = 'company-demo';
  let prisma: { modFlag: { findUnique: jest.Mock } };
  let modules: { isEnabled: jest.Mock };
  let service: FeatureFlagService;

  beforeEach(() => {
    prisma = { modFlag: { findUnique: jest.fn() } };
    modules = { isEnabled: jest.fn() };
    service = new FeatureFlagService(
      prisma as never,
      modules as unknown as ModuleRegistryService,
    );
  });

  it('is off when the parent module is DISABLED', async () => {
    modules.isEnabled.mockResolvedValue(false);
    prisma.modFlag.findUnique.mockResolvedValue({ enabled: true });
    await expect(
      service.isEnabled(companyId, FLAG_KEYS.platformSearch),
    ).resolves.toBe(false);
  });

  it('is off when the flag row is missing or enabled=false', async () => {
    modules.isEnabled.mockResolvedValue(true);
    prisma.modFlag.findUnique.mockResolvedValue(null);
    await expect(
      service.isEnabled(companyId, FLAG_KEYS.platformSearch),
    ).resolves.toBe(false);

    prisma.modFlag.findUnique.mockResolvedValue({ enabled: false });
    await expect(
      service.isEnabled(companyId, FLAG_KEYS.platformSearch),
    ).resolves.toBe(false);
  });

  it('is on only when module ENABLED and flag enabled', async () => {
    modules.isEnabled.mockResolvedValue(true);
    prisma.modFlag.findUnique.mockResolvedValue({ enabled: true });
    await expect(
      service.isEnabled(companyId, FLAG_KEYS.platformSearch),
    ).resolves.toBe(true);
  });
});

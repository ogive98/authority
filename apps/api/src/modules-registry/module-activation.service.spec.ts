import { HttpStatus } from '@nestjs/common';
import { ModModuleStatus } from '@prisma/client';
import { ModuleActivationService } from './module-activation.service';
import { MODULE_ERROR_CODES } from './modules.constants';
import { ModulesException } from './modules.exception';

describe('ModuleActivationService', () => {
  const companyId = 'company-1';
  const actor = { userId: 'sa-1' };

  function build(params: {
    targetKey: string;
    existing: { id: string; status: ModModuleStatus } | null;
    canEnable?: { ok: boolean; missingRequiredDependencies: string[] };
    enabledKeys?: string[];
  }) {
    const enabled = new Set(params.enabledKeys ?? []);
    const prisma = {
      orgCompany: {
        findFirst: jest.fn().mockResolvedValue({ id: companyId }),
      },
      modModuleState: {
        findUnique: jest.fn(
          ({
            where,
          }: {
            where: { companyId_moduleKey: { moduleKey: string } };
          }) => {
            const key = where.companyId_moduleKey.moduleKey;
            if (key === params.targetKey) {
              return Promise.resolve(params.existing);
            }
            if (enabled.has(key)) {
              return Promise.resolve({
                id: `row-${key}`,
                status: ModModuleStatus.ENABLED,
              });
            }
            return Promise.resolve({
              id: `row-${key}`,
              status: ModModuleStatus.DISABLED,
            });
          },
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          modModuleState: {
            upsert: jest.fn().mockResolvedValue({
              id: 'row-1',
              status: ModModuleStatus.ENABLED,
              moduleKey: params.targetKey,
            }),
            update: jest.fn().mockResolvedValue({
              id: 'row-1',
              status: ModModuleStatus.DISABLED,
              moduleKey: params.targetKey,
            }),
            create: jest.fn().mockResolvedValue({
              id: 'row-1',
              status: ModModuleStatus.DISABLED,
              moduleKey: params.targetKey,
            }),
          },
        };
        return fn(tx);
      }),
    };

    const catalog = {
      getByKey: jest.fn((id: string) =>
        id === 'ghost' ? undefined : { id, dependencies: [] },
      ),
      list: jest.fn().mockReturnValue([
        { id: 'inventory', dependencies: [] },
        { id: 'sales', dependencies: ['inventory'] },
      ]),
    };

    const lifecycle = {
      canEnable: jest
        .fn()
        .mockResolvedValue(
          params.canEnable ?? { ok: true, missingRequiredDependencies: [] },
        ),
      evaluateCompanyHealth: jest.fn().mockResolvedValue({ health: 'READY' }),
    };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'aud-1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }) };

    const service = new ModuleActivationService(
      prisma as never,
      catalog as never,
      lifecycle as never,
      audit as never,
      outbox as never,
    );

    return { service, prisma, lifecycle, audit, outbox };
  }

  it('enable is idempotent when already ENABLED', async () => {
    const { service, prisma, audit } = build({
      targetKey: 'sales',
      existing: { id: 'row-1', status: ModModuleStatus.ENABLED },
    });
    const result = await service.enable(companyId, 'sales', actor);
    expect(result.changed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it('enable refuses when required deps missing', async () => {
    const { service } = build({
      targetKey: 'sales',
      existing: { id: 'row-1', status: ModModuleStatus.DISABLED },
      canEnable: {
        ok: false,
        missingRequiredDependencies: ['inventory'],
      },
    });
    await expect(
      service.enable(companyId, 'sales', actor),
    ).rejects.toBeInstanceOf(ModulesException);
    try {
      await service.enable(companyId, 'sales', actor);
    } catch (error) {
      const ex = error as ModulesException;
      expect(ex.code).toBe(MODULE_ERROR_CODES.DEPS_MISSING);
      expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('enable writes audit + outbox when flipping DISABLED → ENABLED', async () => {
    const { service, audit, outbox } = build({
      targetKey: 'sales',
      existing: { id: 'row-1', status: ModModuleStatus.DISABLED },
    });
    const result = await service.enable(companyId, 'sales', actor);
    expect(result.changed).toBe(true);
    expect(audit.append).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('disable refuses when dependents ENABLED unless force', async () => {
    const { service } = build({
      targetKey: 'inventory',
      existing: { id: 'inv-1', status: ModModuleStatus.ENABLED },
      enabledKeys: ['sales'],
    });

    await expect(
      service.disable(companyId, 'inventory', actor),
    ).rejects.toMatchObject({ code: MODULE_ERROR_CODES.HAS_DEPENDENTS });

    const forced = await service.disable(companyId, 'inventory', actor, {
      force: true,
    });
    expect(forced.changed).toBe(true);
  });

  it('disable is idempotent when already DISABLED', async () => {
    const { service, prisma } = build({
      targetKey: 'sales',
      existing: { id: 'row-1', status: ModModuleStatus.DISABLED },
    });
    const result = await service.disable(companyId, 'sales', actor);
    expect(result.changed).toBe(false);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unknown module', async () => {
    const { service } = build({
      targetKey: 'ghost',
      existing: null,
    });
    await expect(
      service.enable(companyId, 'ghost', actor),
    ).rejects.toMatchObject({ code: MODULE_ERROR_CODES.UNKNOWN_MODULE });
  });
});

import { FrgExtensionStatus } from '@prisma/client';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import { ExtensionRegistryService } from './extension-registry.service';
import { FORGE_ERROR_CODES } from './forge.constants';

describe('ExtensionRegistryService (D278)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const ctx = { companyId, userId: '22222222-2222-2222-2222-222222222222' };

  function build(prisma: unknown, audit?: unknown, outbox?: unknown) {
    return new ExtensionRegistryService(
      prisma as never,
      new ExtensionLifecycleService(),
      (audit ?? {
        append: jest.fn().mockResolvedValue({ id: 'aud-1' }),
      }) as never,
      (outbox ?? {
        enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }),
      }) as never,
    );
  }

  it('registers DRAFT extension and audits + outbox', async () => {
    const created = {
      id: 'ext-1',
      companyId,
      key: 'demo-ext',
      name: 'Demo',
      description: null,
      manifestVersion: '0.1.0',
      status: FrgExtensionStatus.DRAFT,
      tenantScope: 'company',
      manifestJson: { key: 'demo-ext', name: 'Demo', version: '0.1.0' },
      dependenciesJson: [],
      compatibleCoreVersion: null,
      createdByUserId: ctx.userId,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const prisma = {
      frgExtension: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          frgExtension: {
            create: jest.fn().mockResolvedValue(created),
          },
        };
        return fn(tx);
      }),
    };
    const svc = build(prisma, audit, outbox);
    const dto = await svc.register(ctx, {
      key: 'demo-ext',
      name: 'Demo',
      manifestVersion: '0.1.0',
    });
    expect(dto.status).toBe('DRAFT');
    expect(dto.key).toBe('demo-ext');
    expect(audit.append).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('rejects DRAFT → ACTIVE without approve path', async () => {
    const row = {
      id: 'ext-1',
      companyId,
      key: 'x',
      name: 'X',
      description: null,
      manifestVersion: '0.1.0',
      status: FrgExtensionStatus.DRAFT,
      tenantScope: 'company',
      manifestJson: {},
      dependenciesJson: [],
      compatibleCoreVersion: null,
      createdByUserId: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      frgExtension: {
        findFirst: jest.fn().mockResolvedValue(row),
      },
      $transaction: jest.fn(),
    };
    const svc = build(prisma);
    await expect(
      svc.transitionStatus(ctx, row.id, FrgExtensionStatus.ACTIVE),
    ).rejects.toMatchObject({ code: FORGE_ERROR_CODES.INVALID_TRANSITION });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows APPROVED → ACTIVE with allowApproveActivate', async () => {
    const row = {
      id: 'ext-1',
      companyId,
      key: 'x',
      name: 'X',
      description: null,
      manifestVersion: '0.1.0',
      status: FrgExtensionStatus.APPROVED,
      tenantScope: 'company',
      manifestJson: {},
      dependenciesJson: [],
      compatibleCoreVersion: null,
      createdByUserId: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updated = { ...row, status: FrgExtensionStatus.ACTIVE, version: 2 };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const prisma = {
      frgExtension: {
        findFirst: jest.fn().mockResolvedValue(row),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          frgExtension: {
            update: jest.fn().mockResolvedValue(updated),
          },
        };
        return fn(tx);
      }),
    };
    const svc = build(prisma, audit, outbox);
    const dto = await svc.transitionStatus(
      ctx,
      row.id,
      FrgExtensionStatus.ACTIVE,
      { allowApproveActivate: true },
    );
    expect(dto.status).toBe('ACTIVE');
    expect(outbox.enqueue).toHaveBeenCalled();
  });
});

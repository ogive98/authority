import { FrgMetadataStatus, FrgMetadataType } from '@prisma/client';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import { MetadataRegistryService } from './metadata-registry.service';
import { FORGE_ERROR_CODES } from './forge.constants';

describe('MetadataRegistryService (D279)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const ctx = { companyId, userId: '22222222-2222-2222-2222-222222222222' };

  function build(prisma: unknown, audit?: unknown, outbox?: unknown) {
    return new MetadataRegistryService(
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

  it('creates DRAFT metadata with audit + outbox', async () => {
    const created = {
      id: 'md-1',
      companyId,
      key: 'sales.order.temp',
      type: FrgMetadataType.field,
      moduleKey: 'sales',
      extensionId: null,
      schemaJson: { commandId: 'nav-sales', aliases: ['température'] },
      status: FrgMetadataStatus.DRAFT,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const prisma = {
      frgExtension: { findFirst: jest.fn() },
      frgMetadataDefinition: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          frgMetadataDefinition: {
            create: jest.fn().mockResolvedValue(created),
          },
        };
        return fn(tx);
      }),
    };
    const svc = build(prisma, audit, outbox);
    const dto = await svc.create(ctx, {
      key: 'sales.order.temp',
      type: FrgMetadataType.field,
      moduleKey: 'sales',
      schemaJson: { commandId: 'nav-sales', aliases: ['température'] },
    });
    expect(dto.status).toBe('DRAFT');
    expect(dto.key).toBe('sales.order.temp');
    expect(audit.append).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('allows DRAFT → ACTIVE and rejects ACTIVE → DRAFT', async () => {
    const row = {
      id: 'md-1',
      companyId,
      key: 'x',
      type: FrgMetadataType.action,
      moduleKey: 'forge',
      extensionId: null,
      schemaJson: {},
      status: FrgMetadataStatus.DRAFT,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const updated = { ...row, status: FrgMetadataStatus.ACTIVE, version: 1 };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const prisma = {
      frgMetadataDefinition: {
        findFirst: jest.fn().mockResolvedValue(row),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          frgMetadataDefinition: {
            update: jest.fn().mockResolvedValue(updated),
          },
        };
        return fn(tx);
      }),
    };
    const svc = build(prisma, audit, outbox);
    const dto = await svc.transitionStatus(ctx, row.id, FrgMetadataStatus.ACTIVE);
    expect(dto.status).toBe('ACTIVE');

    const archived = { ...updated, status: FrgMetadataStatus.ARCHIVED, version: 2 };
    prisma.frgMetadataDefinition.findFirst.mockResolvedValue(archived);
    await expect(
      svc.transitionStatus(ctx, row.id, FrgMetadataStatus.ACTIVE),
    ).rejects.toMatchObject({ code: FORGE_ERROR_CODES.INVALID_TRANSITION });
  });

  it('coverage counts active commandId bridges', async () => {
    const prisma = {
      frgMetadataDefinition: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: FrgMetadataType.action,
            status: FrgMetadataStatus.ACTIVE,
            schemaJson: { commandId: 'nav-sales' },
          },
          {
            type: FrgMetadataType.field,
            status: FrgMetadataStatus.DRAFT,
            schemaJson: {},
          },
        ]),
      },
    };
    const svc = build(prisma);
    const c = await svc.coverage(ctx);
    expect(c.total).toBe(2);
    expect(c.activeWithCommandId).toBe(1);
    expect(c.byStatus.ACTIVE).toBe(1);
  });
});

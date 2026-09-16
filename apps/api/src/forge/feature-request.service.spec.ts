import { FrgFeatureRequestStatus } from '@prisma/client';
import { ExtensionLifecycleService } from './extension-lifecycle.service';
import { FeatureRequestService } from './feature-request.service';
import { FORGE_ERROR_CODES } from './forge.constants';

describe('FeatureRequestService (D278)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const ctx = { companyId, userId: '22222222-2222-2222-2222-222222222222' };

  it('creates RECEIVED feature request with audit + outbox', async () => {
    const created = {
      id: 'fr-1',
      companyId,
      title: 'Champ température',
      description: null,
      status: FrgFeatureRequestStatus.RECEIVED,
      priority: 0,
      source: 'manual',
      requestedByUserId: ctx.userId,
      affectedModulesJson: [],
      extensionId: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const audit = { append: jest.fn().mockResolvedValue({ id: 'a1' }) };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const prisma = {
      frgExtension: { findFirst: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => {
        const tx = {
          frgFeatureRequest: {
            create: jest.fn().mockResolvedValue(created),
          },
        };
        return fn(tx);
      }),
    };
    const svc = new FeatureRequestService(
      prisma as never,
      new ExtensionLifecycleService(),
      audit as never,
      outbox as never,
    );
    const dto = await svc.create(ctx, { title: 'Champ température' });
    expect(dto.status).toBe('RECEIVED');
    expect(audit.append).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('rejects empty title', async () => {
    const svc = new FeatureRequestService(
      {
        frgExtension: { findFirst: jest.fn() },
        $transaction: jest.fn(),
      } as never,
      new ExtensionLifecycleService(),
      { append: jest.fn() } as never,
      { enqueue: jest.fn() } as never,
    );
    await expect(svc.create(ctx, { title: '  ' })).rejects.toMatchObject({
      code: FORGE_ERROR_CODES.VALIDATION,
    });
  });
});

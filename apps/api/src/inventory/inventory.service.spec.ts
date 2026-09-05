import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { INVENTORY_ERROR_CODES } from './inventory.constants';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const warehouseId = '22222222-2222-2222-2222-222222222222';
  const productId = '33333333-3333-3333-3333-333333333333';
  const balanceId = '44444444-4444-4444-4444-444444444444';

  function build(initial?: { onHand?: string; reserved?: string }) {
    const warehouse = {
      id: warehouseId,
      companyId,
      code: 'MAIN',
      name: 'Main',
      active: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const product = {
      id: productId,
      sku: 'BRIE-250',
      name: 'Brie 250',
      uom: 'kg',
      status: 'ACTIVE',
      deletedAt: null,
    };

    let balance = {
      id: balanceId,
      companyId,
      warehouseId,
      productId,
      onHand: new Prisma.Decimal(initial?.onHand ?? '100'),
      reserved: new Prisma.Decimal(initial?.reserved ?? '0'),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }) };

    const prisma = {
      invWarehouse: {
        findFirst: jest.fn().mockResolvedValue(warehouse),
        findFirstOrThrow: jest.fn().mockResolvedValue(warehouse),
      },
      prdProduct: {
        findFirst: jest.fn().mockResolvedValue(product),
        findMany: jest.fn().mockResolvedValue([product]),
      },
      $transaction: jest.fn(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            invBalance: {
              findUnique: jest.fn().mockResolvedValue(balance),
              create: jest.fn(),
              updateMany: jest.fn().mockImplementation(
                async ({
                  data,
                }: {
                  data: {
                    onHand: Prisma.Decimal;
                    reserved: Prisma.Decimal;
                  };
                }) => {
                  balance = {
                    ...balance,
                    onHand: data.onHand,
                    reserved: data.reserved,
                    version: balance.version + 1,
                  };
                  return { count: 1 };
                },
              ),
              findUniqueOrThrow: jest
                .fn()
                .mockImplementation(async () => balance),
            },
            invMovement: {
              create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
            },
          };
          return fn(tx);
        },
      ),
    };

    const service = new InventoryService(prisma as never, outbox as never);
    return { service, outbox, getBalance: () => balance };
  }

  it('adjust increases on_hand and enqueues event', async () => {
    const { service, outbox, getBalance } = build({ onHand: '10' });
    const result = await service.adjust(companyId, {
      productId,
      warehouseId,
      qtyDelta: 5,
      reason: 'receipt',
    });
    expect(result.onHand).toBe('15');
    expect(result.available).toBe('15');
    expect(outbox.enqueue).toHaveBeenCalled();
    expect(getBalance().version).toBe(1);
  });

  it('reserve fails when available insufficient', async () => {
    const { service } = build({ onHand: '10', reserved: '8' });
    await expect(
      service.reserve(companyId, {
        productId,
        warehouseId,
        qty: 5,
      }),
    ).rejects.toMatchObject({
      response: { code: INVENTORY_ERROR_CODES.INSUFFICIENT },
      status: HttpStatus.CONFLICT,
    });
  });

  it('reserve then release restores available', async () => {
    const { service } = build({ onHand: '20', reserved: '0' });
    const reserved = await service.reserve(companyId, {
      productId,
      warehouseId,
      qty: 7,
      refType: 'sales.order',
      refId: 'so-1',
    });
    expect(reserved.reserved).toBe('7');
    expect(reserved.available).toBe('13');

    const released = await service.release(companyId, {
      productId,
      warehouseId,
      qty: 7,
    });
    expect(released.reserved).toBe('0');
    expect(released.available).toBe('20');
  });
});

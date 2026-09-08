import { HttpStatus } from '@nestjs/common';
import { Prisma, ProdWoStatus } from '@prisma/client';
import { PRODUCTION_ERROR_CODES } from './production.constants';
import { ProductionService } from './production.service';

describe('ProductionService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const warehouseId = '22222222-2222-2222-2222-222222222222';
  const productId = '33333333-3333-3333-3333-333333333333';
  const mpId = '44444444-4444-4444-4444-444444444444';
  const woId = '55555555-5555-5555-5555-555555555555';

  function build() {
    const wo: {
      id: string;
      companyId: string;
      number: string;
      productId: string;
      warehouseId: string;
      plannedQty: Prisma.Decimal;
      actualQty: Prisma.Decimal | null;
      lotOut: string | null;
      status: ProdWoStatus;
      notes: string | null;
      version: number;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
      consumptions: unknown[];
      outputs: unknown[];
      scraps: unknown[];
    } = {
      id: woId,
      companyId,
      number: 'OF-2026-0001',
      productId,
      warehouseId,
      plannedQty: new Prisma.Decimal(100),
      actualQty: null,
      lotOut: null,
      status: ProdWoStatus.PLANNED,
      notes: null,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      consumptions: [],
      outputs: [],
      scraps: [],
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'ob-1' }) };
    const inventory = {
      adjust: jest.fn().mockResolvedValue({ id: 'bal-1' }),
    };

    const prisma: Record<string, unknown> = {
      prodWorkOrder: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(wo),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...wo,
          ...data,
          consumptions: [],
          outputs: [],
          scraps: [],
        })),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          ...wo,
          ...data,
          status: (data.status as ProdWoStatus) ?? wo.status,
          consumptions: wo.consumptions,
          outputs: wo.outputs,
          scraps: wo.scraps,
        })),
      },
      prodWoConsumption: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'cons-1',
          ...data,
          postedAt: new Date(),
        })),
      },
      prodWoOutput: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'out-1',
          ...data,
          postedAt: new Date(),
        })),
      },
      prodScrap: {
        create: jest.fn(),
      },
      prdProduct: {
        findFirst: jest.fn().mockResolvedValue({
          id: productId,
          sku: 'BRIE',
          name: 'Brie',
          status: 'ACTIVE',
          deletedAt: null,
        }),
      },
      invWarehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: warehouseId,
          code: 'MAIN',
          active: true,
          deletedAt: null,
        }),
      },
      $transaction: jest.fn(
        async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
          fn(prisma),
      ),
    };

    const service = new ProductionService(
      prisma as never,
      inventory as never,
      outbox as never,
    );

    return { service, prisma, inventory, outbox, wo };
  }

  it('creates a planned work order', async () => {
    const { service, outbox } = build();
    const dto = await service.create(companyId, {
      productId,
      warehouseId,
      plannedQty: 100,
    });
    expect(dto.number).toMatch(/^OF-/);
    expect(dto.status).toBe(ProdWoStatus.PLANNED);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('releases planned → RELEASED', async () => {
    const { service, wo } = build();
    wo.status = ProdWoStatus.PLANNED;
    const dto = await service.release(companyId, woId);
    expect(dto.status).toBe(ProdWoStatus.RELEASED);
  });

  it('rejects declare without consumptions', async () => {
    const { service, wo } = build();
    wo.status = ProdWoStatus.RELEASED;
    await expect(
      service.declare(companyId, woId, {
        consumptions: [],
        outputQty: 90,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: PRODUCTION_ERROR_CODES.BOM_MISSING },
    });
  });

  it('declares consumption + output and posts inventory', async () => {
    const { service, inventory, wo } = build();
    wo.status = ProdWoStatus.RELEASED;
    const dto = await service.declare(companyId, woId, {
      consumptions: [{ productId: mpId, qty: 50 }],
      outputQty: 95,
      lotOut: 'LOT-1',
    });
    expect(inventory.adjust).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ productId: mpId, qtyDelta: -50 }),
    );
    expect(inventory.adjust).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ productId, qtyDelta: 95 }),
    );
    expect(dto.status).toBe(ProdWoStatus.DONE);
    expect(dto.actualQty).toBe('95');
  });
});

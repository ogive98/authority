import { HttpStatus } from '@nestjs/common';
import { Prisma, PrdProductStatus } from '@prisma/client';
import { PRODUCTS_ERROR_CODES } from './products.constants';
import { ProductsException } from './products.exception';
import { ProductsService } from './products.service';
import type { MasterDataService } from '../master-data/master-data.service';

describe('ProductsService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';

  function build(
    prisma: {
      prdProduct: {
        findMany?: jest.Mock;
        findFirst?: jest.Mock;
        create?: jest.Mock;
        update?: jest.Mock;
      };
    },
    masterData: Partial<MasterDataService> = {},
  ) {
    const md = {
      assertProductRefs: jest.fn().mockResolvedValue(undefined),
      ...masterData,
    };
    return new ProductsService(prisma as never, md as MasterDataService);
  }

  const baseRow = {
    id: productId,
    companyId,
    sku: 'FROM-001',
    name: 'Brie 250g',
    typeKey: 'FINISHED',
    uom: 'kg',
    trackLot: true,
    perishable: true,
    storageClassKey: 'COLD',
    allergenFlags: ['milk'],
    status: PrdProductStatus.DRAFT,
    version: 0,
    createdAt: new Date('2026-09-04T12:00:00.000Z'),
    updatedAt: new Date('2026-09-04T12:00:00.000Z'),
    deletedAt: null,
  };

  it('creates a draft product', async () => {
    const create = jest.fn().mockResolvedValue(baseRow);
    const svc = build({ prdProduct: { create } });
    const dto = await svc.create(companyId, {
      sku: 'FROM-001',
      name: 'Brie 250g',
      typeKey: 'FINISHED',
      uom: 'kg',
      trackLot: true,
      perishable: true,
      storageClassKey: 'COLD',
      allergenFlags: ['milk'],
    });
    expect(dto.status).toBe(PrdProductStatus.DRAFT);
    expect(dto.typeKey).toBe('FINISHED');
    expect(create).toHaveBeenCalled();
  });

  it('maps unique violation to PRO.SKU_DUP', async () => {
    const prismaErr = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '6',
    });
    const create = jest.fn().mockRejectedValue(prismaErr);
    const svc = build({ prdProduct: { create } });
    await expect(
      svc.create(companyId, {
        sku: 'FROM-001',
        name: 'Brie',
        typeKey: 'FINISHED',
        uom: 'kg',
        storageClassKey: 'COLD',
      }),
    ).rejects.toMatchObject({
      code: PRODUCTS_ERROR_CODES.SKU_DUP,
      status: HttpStatus.CONFLICT,
    });
  });

  it('activates draft only', async () => {
    const findFirst = jest.fn().mockResolvedValue(baseRow);
    const update = jest.fn().mockResolvedValue({
      ...baseRow,
      status: PrdProductStatus.ACTIVE,
      version: 1,
    });
    const svc = build({ prdProduct: { findFirst, update } });
    const dto = await svc.activate(companyId, productId);
    expect(dto.status).toBe(PrdProductStatus.ACTIVE);
  });

  it('rejects activate on obsolete', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      ...baseRow,
      status: PrdProductStatus.OBSOLETE,
    });
    const svc = build({ prdProduct: { findFirst } });
    await expect(svc.activate(companyId, productId)).rejects.toBeInstanceOf(
      ProductsException,
    );
  });

  it('soft-deletes as obsolete', async () => {
    const findFirst = jest.fn().mockResolvedValue(baseRow);
    const update = jest
      .fn()
      .mockResolvedValue({ ...baseRow, deletedAt: new Date() });
    const svc = build({ prdProduct: { findFirst, update } });
    await svc.softDelete(companyId, productId);
    const calls = update.mock.calls as unknown as Array<
      [{ data: { status: PrdProductStatus } }]
    >;
    expect(calls[0][0].data.status).toBe(PrdProductStatus.OBSOLETE);
  });

  it('version conflict on update', async () => {
    const findFirst = jest.fn().mockResolvedValue(baseRow);
    const svc = build({ prdProduct: { findFirst } });
    await expect(
      svc.update(companyId, productId, { version: 99, name: 'x' }),
    ).rejects.toMatchObject({ code: PRODUCTS_ERROR_CODES.VERSION_CONFLICT });
  });
});

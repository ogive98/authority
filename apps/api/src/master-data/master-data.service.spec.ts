import { HttpStatus } from '@nestjs/common';
import { MdRefKind } from '@prisma/client';
import { PRODUCTS_ERROR_CODES } from '../products/products.constants';
import { MasterDataService } from './master-data.service';

describe('MasterDataService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  it('assertProductRefs rejects unknown type', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const svc = new MasterDataService({
      mdRefValue: { findFirst },
    } as never);
    await expect(
      svc.assertProductRefs(companyId, {
        typeKey: 'NOPE',
        uom: 'kg',
        storageClassKey: 'COLD',
        allergenFlags: [],
      }),
    ).rejects.toMatchObject({
      code: PRODUCTS_ERROR_CODES.REF_UNKNOWN,
      status: HttpStatus.BAD_REQUEST,
    });
  });

  it('listRefs returns enabled rows', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        kind: MdRefKind.product_type,
        code: 'FINISHED',
        label: 'Produit fini',
        sort: 10,
        enabled: true,
        metaJson: {},
      },
    ]);
    const svc = new MasterDataService({
      mdRefValue: { findMany },
    } as never);
    const res = await svc.listRefs(companyId, MdRefKind.product_type);
    expect(res.items).toHaveLength(1);
    expect(res.items[0].code).toBe('FINISHED');
  });
});

import { HttpStatus } from '@nestjs/common';
import {
  PrdFiscalOverrideMode,
  TaxDecisionSource,
  TaxKind,
  TaxRuleStatus,
} from '@prisma/client';
import { PRODUCTS_ERROR_CODES, PRODUCTS_EVENT_TYPES } from './products.constants';
import { ProductFiscalService } from './product-fiscal.service';
import { ProductsException } from './products.exception';

describe('ProductFiscalService (D261)', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const productId = '22222222-2222-2222-2222-222222222222';
  const taxCodeId = '33333333-3333-3333-3333-333333333333';
  const profileId = '44444444-4444-4444-4444-444444444444';
  const overrideId = '55555555-5555-5555-5555-555555555555';

  const taxCode = {
    id: taxCodeId,
    companyId,
    code: 'TVA19',
    label: 'TVA 19%',
    kind: TaxKind.VAT,
    status: TaxRuleStatus.ACTIVE,
    active: true,
  };

  function build(opts?: {
    profile?: Record<string, unknown> | null;
    override?: Record<string, unknown> | null;
  }) {
    const profile =
      opts?.profile === null
        ? null
        : {
            id: profileId,
            companyId,
            productId,
            defaultVatTaxCodeId: taxCodeId,
            hsCode: null,
            fiscalCategory: null,
            notes: null,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            defaultVatCode: taxCode,
            ...opts?.profile,
          };

    const override =
      opts?.override === undefined
        ? null
        : opts.override === null
          ? null
          : {
              id: overrideId,
              companyId,
              productId,
              taxCodeId,
              mode: PrdFiscalOverrideMode.NEVER,
              source: TaxDecisionSource.EXEMPTION,
              validFrom: null,
              validTo: null,
              justification: 'exonéré',
              reference: null,
              documentId: null,
              comment: null,
              version: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
              deletedAt: null,
              taxCode,
              ...opts.override,
            };

    const prisma: Record<string, unknown> = {
      prdFiscalProfile: {
        findFirst: jest.fn().mockResolvedValue(profile),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...profile, ...data, id: profileId, version: 0 }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...profile, ...data, version: 1 }),
        ),
      },
      prdFiscalRuleOverride: {
        findFirst: jest.fn().mockResolvedValue(override),
        findMany: jest.fn().mockResolvedValue(override ? [override] : []),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...data, id: overrideId, version: 0, taxCode }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...override, ...data, version: 1 }),
        ),
      },
      taxCode: {
        findFirst: jest.fn().mockResolvedValue(taxCode),
        findMany: jest.fn().mockResolvedValue([taxCode]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const products = {
      get: jest.fn().mockResolvedValue({
        id: productId,
        sku: 'BRIE-001',
      }),
    };
    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const service = new ProductFiscalService(
      prisma as never,
      products as never,
      outbox as never,
    );
    return { service, prisma, outbox, products };
  }

  it('upserts a fiscal profile and emits products.fiscal.updated.v1', async () => {
    const { service, outbox } = build({ profile: null, override: null });
    const dto = await service.upsertProfile(companyId, productId, {
      defaultVatTaxCodeId: taxCodeId,
      hsCode: '0406',
      version: 0,
    });
    expect(dto.sku).toBe('BRIE-001');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: PRODUCTS_EVENT_TYPES.FISCAL_UPDATED,
      }),
    );
  });

  it('rejects NEVER without justification', async () => {
    const { service } = build({ override: null });
    await expect(
      service.upsertOverride(companyId, productId, {
        taxCodeId,
        mode: 'NEVER',
        justification: '   ',
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { code: PRODUCTS_ERROR_CODES.FISCAL_JUSTIFICATION },
    });
    expect.assertions(1);
  });

  it('rejects NEVER with SYSTEM_RULE source', async () => {
    const { service } = build({ override: null });
    try {
      await service.upsertOverride(companyId, productId, {
        taxCodeId,
        mode: 'NEVER',
        source: 'SYSTEM_RULE',
        justification: 'test',
      });
      throw new Error('expected ProductsException');
    } catch (error) {
      expect(error).toBeInstanceOf(ProductsException);
      expect((error as ProductsException).code).toBe(
        PRODUCTS_ERROR_CODES.FISCAL_INVALID_MODE,
      );
    }
  });
});

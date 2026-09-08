import { HttpStatus } from '@nestjs/common';
import { TaxKind } from '@prisma/client';
import { TAX_ERROR_CODES } from './tax.constants';
import { TaxService, taxFromHt } from './tax.service';

describe('TaxService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const codeId = '22222222-2222-2222-2222-222222222222';
  const rateId = '33333333-3333-3333-3333-333333333333';

  function build() {
    const code = {
      id: codeId,
      companyId,
      code: 'TVA19',
      label: 'TVA normale 19%',
      kind: TaxKind.VAT,
      active: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    const rate = {
      id: rateId,
      companyId,
      taxCodeId: codeId,
      rateBps: 1900,
      validFrom: new Date('2018-01-01T00:00:00.000Z'),
      validTo: null as Date | null,
      lawRef: 'Code TVA art.7',
      expertValidatedAt: new Date('2026-09-08T00:00:00.000Z'),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      taxCode: {
        findMany: jest.fn().mockResolvedValue([code]),
        findFirst: jest.fn().mockResolvedValue(code),
      },
      taxRate: {
        findMany: jest.fn().mockResolvedValue([rate]),
        findFirst: jest.fn().mockResolvedValue(rate),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...rate, ...data, id: rateId }),
        ),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...rate, ...data }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new TaxService(prisma as never, outbox as never);
    return { service, prisma, outbox };
  }

  it('computes tax from HT with basis points', () => {
    expect(taxFromHt(100, 1900)).toBe(19);
    expect(taxFromHt(100, 700)).toBe(7);
    expect(taxFromHt(42.017, 1900)).toBe(7.983);
    expect(taxFromHt(100, 0)).toBe(0);
  });

  it('lists codes with current rate', async () => {
    const { service } = build();
    const { items } = await service.listCodes(companyId);
    expect(items).toHaveLength(1);
    expect(items[0]!.code).toBe('TVA19');
    expect(items[0]!.currentRateBps).toBe(1900);
  });

  it('resolves rate bps for invoice computation', async () => {
    const { service } = build();
    const resolved = await service.resolveRateBps(companyId, codeId);
    expect(resolved.rateBps).toBe(1900);
  });

  it('rejects missing tax code', async () => {
    const { service, prisma } = build();
    prisma.taxCode.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.resolveRateBps(companyId, codeId)).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
      response: { code: TAX_ERROR_CODES.CODE_NOT_FOUND },
    });
  });
});

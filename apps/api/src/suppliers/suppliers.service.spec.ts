import { HttpStatus } from '@nestjs/common';
import { MdPartyType, SupSupplierCategory } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { SUPPLIERS_ERROR_CODES } from './suppliers.constants';

describe('SuppliersService (unit wiring)', () => {
  it('exposes error codes for AUTHORITY clients', () => {
    expect(SUPPLIERS_ERROR_CODES.NOT_FOUND).toBe('SUP.NOT_FOUND');
    expect(SUPPLIERS_ERROR_CODES.CODE_DUP).toBe('SUP.CODE_DUP');
  });

  it('rejects create without legalName or partyId', async () => {
    const prisma = {
      $transaction: jest.fn(),
      supSupplier: { findMany: jest.fn(), findFirst: jest.fn() },
      supContact: { findMany: jest.fn() },
    };
    const masterData = {
      createParty: jest.fn(),
      requireParty: jest.fn(),
    };
    const outbox = { enqueue: jest.fn() };
    const svc = new SuppliersService(
      prisma as never,
      masterData as never,
      outbox as never,
    );

    await expect(
      svc.create('company-1', { code: 'F-01' } as never),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({
        code: SUPPLIERS_ERROR_CODES.PARTY_NOT_FOUND,
      }),
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('documents category enum for V0', () => {
    expect(Object.values(SupSupplierCategory)).toEqual(
      expect.arrayContaining([
        'LAIT',
        'EMBALLAGE',
        'FOURNITURE',
        'IMPORT',
      ]),
    );
    expect(MdPartyType.SUPPLIER).toBe('SUPPLIER');
  });
});

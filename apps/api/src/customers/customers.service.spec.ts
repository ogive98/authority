import { HttpStatus } from '@nestjs/common';
import { CusCustomerStatus, MdPartyType } from '@prisma/client';
import { CUSTOMERS_ERROR_CODES } from './customers.constants';
import { CustomersException } from './customers.exception';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';

  function build() {
    const party = {
      id: '22222222-2222-2222-2222-222222222222',
      companyId,
      type: MdPartyType.CUSTOMER,
      legalName: 'Fromagerie Atlas',
      taxId: null,
      defaultLang: null,
      status: 'ACTIVE',
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const customer = {
      id: '33333333-3333-3333-3333-333333333333',
      companyId,
      partyId: party.id,
      code: 'C-001',
      salesRep: null,
      paymentTerms: null,
      status: CusCustomerStatus.ACTIVE,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      party,
    };

    const prisma = {
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([customer]),
        findFirst: jest.fn().mockResolvedValue(customer),
        create: jest.fn().mockResolvedValue(customer),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cusContact: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn(),
        findFirst: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      mdParty: {
        update: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          cusCustomer: {
            create: jest.fn().mockResolvedValue(customer),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          cusContact: { createMany: jest.fn() },
          mdParty: { update: jest.fn() },
        }),
      ),
    };

    const masterData = {
      createParty: jest.fn().mockResolvedValue(party),
      requireParty: jest.fn().mockResolvedValue(party),
    };

    const service = new CustomersService(prisma as never, masterData as never);
    return { service, prisma, masterData, customer, party };
  }

  it('lists customers with party legalName', async () => {
    const { service } = build();
    const result = await service.list(companyId);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].legalName).toBe('Fromagerie Atlas');
    expect(result.items[0].code).toBe('C-001');
  });

  it('creates customer with inline party', async () => {
    const { service, masterData, prisma, customer } = build();
    prisma.cusCustomer.findFirst.mockResolvedValue(customer);
    const created = await service.create(companyId, {
      code: 'C-001',
      legalName: 'Fromagerie Atlas',
    });
    expect(masterData.createParty).toHaveBeenCalled();
    expect(created.code).toBe('C-001');
  });

  it('rejects update on version conflict', async () => {
    const { service } = build();
    await expect(
      service.update(companyId, '33333333-3333-3333-3333-333333333333', {
        legalName: 'X',
        version: 9,
      }),
    ).rejects.toMatchObject({
      code: CUSTOMERS_ERROR_CODES.VERSION_CONFLICT,
      status: HttpStatus.CONFLICT,
    });
  });

  it('throws NOT_FOUND when customer missing', async () => {
    const { service, prisma } = build();
    prisma.cusCustomer.findFirst.mockResolvedValue(null);
    await expect(
      service.get(companyId, '33333333-3333-3333-3333-333333333333'),
    ).rejects.toBeInstanceOf(CustomersException);
  });
});

import { HttpStatus } from '@nestjs/common';
import { CusCustomerStatus, MdPartyType, Prisma } from '@prisma/client';
import { CUSTOMERS_ERROR_CODES } from './customers.constants';
import { CustomersException } from './customers.exception';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '33333333-3333-3333-3333-333333333333';

  function build(opts?: { blocked?: boolean; version?: number }) {
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

    const zone = {
      id: '44444444-4444-4444-4444-444444444444',
      companyId,
      code: 'SF-NORD',
      name: 'Zone Nord',
      active: true,
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const customer = {
      id: customerId,
      companyId,
      partyId: party.id,
      code: 'C-001',
      nickname: null,
      salesRep: null,
      paymentTerms: null,
      creditLimit: null as Prisma.Decimal | null,
      zoneId: zone.id as string | null,
      blocked: opts?.blocked ?? false,
      blockedAt: opts?.blocked ? new Date() : null,
      blockedReason: opts?.blocked ? 'Retard' : null,
      status: CusCustomerStatus.ACTIVE,
      version: opts?.version ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      party,
      zone,
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
      cusZone: {
        findMany: jest.fn().mockResolvedValue([zone]),
        findFirst: jest.fn().mockResolvedValue(zone),
        create: jest.fn().mockResolvedValue(zone),
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
    return { service, prisma, masterData, customer, party, zone };
  }

  it('lists customers with party legalName', async () => {
    const { service } = build();
    const result = await service.list(companyId);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].legalName).toBe('Fromagerie Atlas');
    expect(result.items[0].code).toBe('C-001');
    expect(result.items[0].zoneCode).toBe('SF-NORD');
    expect(result.items[0].blocked).toBe(false);
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
      service.update(companyId, customerId, {
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
    await expect(service.get(companyId, customerId)).rejects.toBeInstanceOf(
      CustomersException,
    );
  });

  it('lists zones', async () => {
    const { service } = build();
    const zones = await service.listZones(companyId);
    expect(zones).toHaveLength(1);
    expect(zones[0].code).toBe('SF-NORD');
  });

  it('sets credit limit', async () => {
    const { service, prisma, customer } = build();
    const after = {
      ...customer,
      creditLimit: new Prisma.Decimal('1500.000'),
      version: 1,
    };
    prisma.cusCustomer.findFirst
      .mockResolvedValueOnce(customer)
      .mockResolvedValueOnce(after);
    const result = await service.setCredit(companyId, customerId, {
      creditLimit: '1500.000',
      version: 0,
    });
    expect(prisma.cusCustomer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          creditLimit: expect.any(Prisma.Decimal),
        }),
      }),
    );
    expect(result.creditLimit).toBe('1500');
  });

  it('blocks customer', async () => {
    const { service, prisma, customer } = build();
    const after = {
      ...customer,
      blocked: true,
      blockedAt: new Date(),
      blockedReason: 'Impayé',
      version: 1,
    };
    prisma.cusCustomer.findFirst
      .mockResolvedValueOnce(customer)
      .mockResolvedValueOnce(after);
    const result = await service.block(companyId, customerId, {
      reason: 'Impayé',
      version: 0,
    });
    expect(result.blocked).toBe(true);
    expect(result.blockedReason).toBe('Impayé');
  });

  it('rejects block when already blocked', async () => {
    const { service } = build({ blocked: true });
    await expect(
      service.block(companyId, customerId, { version: 0 }),
    ).rejects.toMatchObject({
      code: CUSTOMERS_ERROR_CODES.ALREADY_BLOCKED,
      status: HttpStatus.CONFLICT,
    });
  });

  it('unblocks customer', async () => {
    const { service, prisma, customer } = build({ blocked: true });
    const after = {
      ...customer,
      blocked: false,
      blockedAt: null,
      blockedReason: null,
      version: 1,
    };
    prisma.cusCustomer.findFirst
      .mockResolvedValueOnce(customer)
      .mockResolvedValueOnce(after);
    const result = await service.unblock(companyId, customerId, {
      version: 0,
    });
    expect(result.blocked).toBe(false);
  });

  it('rejects unblock when not blocked', async () => {
    const { service } = build({ blocked: false });
    await expect(
      service.unblock(companyId, customerId, { version: 0 }),
    ).rejects.toMatchObject({
      code: CUSTOMERS_ERROR_CODES.NOT_BLOCKED,
      status: HttpStatus.CONFLICT,
    });
  });
});

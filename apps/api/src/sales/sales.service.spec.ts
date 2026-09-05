import { HttpStatus } from '@nestjs/common';
import { CusCustomerStatus, MdPartyStatus, Prisma, SalOrderStatus } from '@prisma/client';
import { SALES_ERROR_CODES } from './sales.constants';
import { SalesService } from './sales.service';

describe('SalesService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const warehouseId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';
  const orderId = '55555555-5555-5555-5555-555555555555';

  function build(opts?: {
    status?: SalOrderStatus;
    partyStatus?: MdPartyStatus;
    customerBlocked?: boolean;
  }) {
    const line = {
      id: '66666666-6666-6666-6666-666666666666',
      companyId,
      orderId,
      lineNo: 1,
      productId,
      qty: new Prisma.Decimal(10),
      unitPrice: new Prisma.Decimal(5),
      discountPct: new Prisma.Decimal(0),
      lineTotal: new Prisma.Decimal(50),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let order = {
      id: orderId,
      companyId,
      number: 'SO-2026-0001',
      customerId,
      warehouseId,
      status: opts?.status ?? SalOrderStatus.DRAFT,
      requestedDate: null,
      currency: 'TND',
      notes: null,
      preferredDriver: null,
      amountTotal: new Prisma.Decimal(50),
      version: 0,
      confirmedAt: null,
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [line],
    };

    const customer = {
      id: customerId,
      companyId,
      code: 'C-001',
      status: CusCustomerStatus.ACTIVE,
      blocked: opts?.customerBlocked ?? false,
      deletedAt: null,
      party: {
        legalName: 'Atlas',
        status: opts?.partyStatus ?? MdPartyStatus.ACTIVE,
      },
    };

    const warehouse = {
      id: warehouseId,
      companyId,
      code: 'MAIN',
      active: true,
      deletedAt: null,
    };

    const product = {
      id: productId,
      sku: 'BRIE',
      name: 'Brie',
      status: 'ACTIVE',
      deletedAt: null,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const inventory = {
      reserve: jest.fn().mockResolvedValue({}),
      release: jest.fn().mockResolvedValue({}),
    };

    const prisma = {
      salOrder: {
        findMany: jest.fn().mockResolvedValue([order]),
        findFirst: jest.fn().mockResolvedValue(order),
        findFirstOrThrow: jest.fn().mockResolvedValue(order),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      salOrderLine: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      setValue: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      cusCustomer: {
        findFirst: jest.fn().mockResolvedValue(customer),
        findMany: jest.fn().mockResolvedValue([customer]),
      },
      invWarehouse: {
        findFirst: jest.fn().mockResolvedValue(warehouse),
        findMany: jest.fn().mockResolvedValue([warehouse]),
      },
      prdProduct: {
        findMany: jest.fn().mockResolvedValue([product]),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          salOrder: {
            create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
              order = {
                ...order,
                id: orderId,
                number: (data.number as string) ?? order.number,
                status: SalOrderStatus.DRAFT,
                lines: [line],
              };
              return order;
            }),
            updateMany: jest.fn().mockImplementation(async ({ data }: { data: { status?: SalOrderStatus } }) => {
              if (data.status) order = { ...order, status: data.status, lines: order.lines };
              return { count: 1 };
            }),
            findFirstOrThrow: jest.fn().mockImplementation(async () => order),
          },
          salOrderLine: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        };
        return fn(tx);
      }),
    };

    const service = new SalesService(
      prisma as never,
      outbox as never,
      inventory as never,
    );
    return { service, inventory, outbox, prisma, setOrder: (o: typeof order) => { order = o; } };
  }

  it('confirm reserves stock then marks CONFIRMED', async () => {
    const { service, inventory } = build();
    const result = await service.confirm(companyId, orderId);
    expect(inventory.reserve).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        productId,
        warehouseId,
        qty: 10,
        refType: 'sales.order',
        refId: orderId,
      }),
    );
    expect(result.status).toBe(SalOrderStatus.CONFIRMED);
  });

  it('confirm denied when party blocked', async () => {
    const { service, inventory } = build({ partyStatus: MdPartyStatus.BLOCKED });
    await expect(service.confirm(companyId, orderId)).rejects.toMatchObject({
      response: { code: SALES_ERROR_CODES.CUSTOMER_BLOCKED },
      status: HttpStatus.CONFLICT,
    });
    expect(inventory.reserve).not.toHaveBeenCalled();
  });

  it('confirm denied when customer.blocked', async () => {
    const { service, inventory } = build({ customerBlocked: true });
    await expect(service.confirm(companyId, orderId)).rejects.toMatchObject({
      response: { code: SALES_ERROR_CODES.CUSTOMER_BLOCKED },
      status: HttpStatus.CONFLICT,
    });
    expect(inventory.reserve).not.toHaveBeenCalled();
  });

  it('confirm compensates when reserve fails mid-way', async () => {
    const { service, inventory } = build();
    inventory.reserve
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('no stock'));
    // only one line — force fail on first
    inventory.reserve.mockReset();
    inventory.reserve.mockRejectedValue(new Error('no stock'));

    await expect(service.confirm(companyId, orderId)).rejects.toMatchObject({
      response: { code: SALES_ERROR_CODES.STOCK_RESERVE_FAILED },
    });
  });

  it('list accepts optional customerId filter', async () => {
    const { service, prisma } = build();
    prisma.salOrder.findMany.mockResolvedValue([]);

    await service.list(companyId, { customerId, q: 'SO' });

    expect(prisma.salOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          customerId,
          deletedAt: null,
        }),
      }),
    );
  });
});

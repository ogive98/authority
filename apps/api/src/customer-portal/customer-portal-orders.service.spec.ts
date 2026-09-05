import { HttpStatus } from '@nestjs/common';
import { SalOrderStatus } from '@prisma/client';
import { SalesException } from '../sales/sales.exception';
import { SALES_ERROR_CODES } from '../sales/sales.constants';
import type { SalesOrderDto, SalesService } from '../sales/sales.service';
import { CUSTOMER_PORTAL_ERROR_CODES } from './customer-portal.constants';
import { CustomerPortalOrdersService } from './customer-portal-orders.service';

describe('CustomerPortalOrdersService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const otherCustomerId = '99999999-9999-9999-9999-999999999999';
  const orderId = '55555555-5555-5555-5555-555555555555';
  const productId = 'prod-1';
  const warehouseId = 'wh-1';

  const ownOrder: SalesOrderDto = {
    id: orderId,
    companyId,
    number: 'SO-2026-0001',
    customerId,
    customerCode: 'C-001',
    customerName: 'Atlas',
    warehouseId,
    warehouseCode: 'MAIN',
    status: SalOrderStatus.CONFIRMED,
    requestedDate: '2026-09-10',
    currency: 'TND',
    notes: 'INTERNAL — must not leak',
    preferredDriver: 'Karim',
    amountTotal: '50.000',
    version: 1,
    confirmedAt: '2026-09-05T10:00:00.000Z',
    cancelledAt: null,
    createdAt: '2026-09-04T10:00:00.000Z',
    updatedAt: '2026-09-05T10:00:00.000Z',
    lines: [
      {
        id: 'line-1',
        lineNo: 1,
        productId,
        productSku: 'BRIE',
        productName: 'Brie',
        qty: '10.000',
        unitPrice: '5.000',
        discountPct: '0',
        lineTotal: '50.000',
      },
    ],
  };

  let prisma: {
    salOrder: { count: jest.Mock };
    salOrderLine: { findMany: jest.Mock };
    invWarehouse: { findFirst: jest.Mock };
    prdProduct: { findMany: jest.Mock };
    dlvShipment: { count: jest.Mock };
  };
  let salesService: {
    list: jest.Mock;
    get: jest.Mock;
    create: jest.Mock;
    getIntakeSettings: jest.Mock;
  };
  let deliveryService: {
    list: jest.Mock;
    get: jest.Mock;
  };
  let financeService: {
    sumOutstanding: jest.Mock;
    list: jest.Mock;
    get: jest.Mock;
    creditSnapshot: jest.Mock;
  };
  let service: CustomerPortalOrdersService;

  beforeEach(() => {
    prisma = {
      salOrder: { count: jest.fn().mockResolvedValue(2) },
      salOrderLine: { findMany: jest.fn().mockResolvedValue([]) },
      invWarehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: warehouseId }),
      },
      prdProduct: { findMany: jest.fn().mockResolvedValue([]) },
      dlvShipment: { count: jest.fn().mockResolvedValue(1) },
    };
    salesService = {
      list: jest.fn(),
      get: jest.fn(),
      create: jest.fn(),
      getIntakeSettings: jest
        .fn()
        .mockResolvedValue({ defaultCurrency: 'TND' }),
    };
    deliveryService = {
      list: jest.fn(),
      get: jest.fn(),
    };
    financeService = {
      sumOutstanding: jest.fn().mockResolvedValue(50),
      list: jest.fn(),
      get: jest.fn(),
      creditSnapshot: jest.fn().mockResolvedValue({
        customerId,
        creditLimit: '1000.000',
        outstandingBalance: '50.000',
        currency: 'TND',
      }),
    };
    service = new CustomerPortalOrdersService(
      prisma as never,
      salesService as unknown as SalesService,
      deliveryService as never,
      financeService as never,
    );
  });

  it('lists only via membership customerId (never query customerId)', async () => {
    salesService.list.mockResolvedValue({
      items: [ownOrder],
      nextCursor: null,
    });

    const result = await service.listOrders(companyId, customerId, {
      q: 'SO',
      limit: 20,
    });

    expect(salesService.list).toHaveBeenCalledWith(companyId, {
      q: 'SO',
      limit: 20,
      customerId,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].number).toBe('SO-2026-0001');
    expect(result.items[0]).not.toHaveProperty('notes');
    expect(result.items[0]).not.toHaveProperty('warehouseId');
    expect(result.items[0].lines[0]).toEqual({
      sku: 'BRIE',
      name: 'Brie',
      qty: '10.000',
      unitPrice: '5.000',
      lineTotal: '50.000',
    });
    expect(JSON.stringify(result)).not.toContain('INTERNAL');
  });

  it('returns 404 POR.NOT_FOUND for another customer order (IDOR)', async () => {
    salesService.get.mockResolvedValue({
      ...ownOrder,
      customerId: otherCustomerId,
    });

    await expect(
      service.getOrder(companyId, customerId, orderId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      }),
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('maps missing sales order to POR.NOT_FOUND', async () => {
    salesService.get.mockRejectedValue(
      new SalesException(
        SALES_ERROR_CODES.NOT_FOUND,
        'Sales order not found.',
        HttpStatus.NOT_FOUND,
      ),
    );

    await expect(
      service.getOrder(companyId, customerId, orderId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      }),
    });
  });

  it('returns own order as PortalOrderDto without notes', async () => {
    salesService.get.mockResolvedValue(ownOrder);

    const dto = await service.getOrder(companyId, customerId, orderId);

    expect(dto.id).toBe(orderId);
    expect(dto.status).toBe(SalOrderStatus.CONFIRMED);
    expect(dto).not.toHaveProperty('notes');
    expect(JSON.stringify(dto)).not.toContain('INTERNAL');
  });

  it('dashboard openOrders counts DRAFT+CONFIRMED for membership customer', async () => {
    const shell = await service.getDashboardShell(companyId, customerId);

    expect(prisma.salOrder.count).toHaveBeenCalledWith({
      where: {
        companyId,
        customerId,
        deletedAt: null,
        status: { in: [SalOrderStatus.DRAFT, SalOrderStatus.CONFIRMED] },
      },
    });
    expect(prisma.dlvShipment.count).toHaveBeenCalled();
    expect(financeService.sumOutstanding).toHaveBeenCalledWith(
      companyId,
      customerId,
    );
    expect(shell.kpis.openOrders).toBe(2);
    expect(shell.kpis.pendingDeliveries).toBe(1);
    expect(shell.kpis.outstandingBalance).toBe(50);
    expect(shell.message).toContain('P4');
  });

  it('creates draft with membership ids, last price, confirmAfter false', async () => {
    prisma.salOrderLine.findMany.mockResolvedValue([
      { productId, unitPrice: 5 },
    ]);
    const created = {
      ...ownOrder,
      id: 'new-order',
      number: 'SO-2026-0002',
      status: SalOrderStatus.DRAFT,
      notes: 'INTERNAL create',
    };
    salesService.create.mockResolvedValue(created);

    const dto = await service.createOrder(companyId, customerId, {
      lines: [{ productId, qty: 2 }],
      requestedDate: '2026-09-12',
    });

    expect(salesService.create).toHaveBeenCalledWith(companyId, {
      customerId,
      warehouseId,
      requestedDate: '2026-09-12',
      preferredDriver: undefined,
      lines: [{ productId, qty: 2, unitPrice: 5 }],
      confirmAfter: false,
    });
    expect(dto.id).toBe('new-order');
    expect(dto).not.toHaveProperty('notes');
    expect(dto).not.toHaveProperty('warehouseId');
    expect(JSON.stringify(dto)).not.toContain('INTERNAL');
  });

  it('rejects create when no last price for product', async () => {
    prisma.salOrderLine.findMany.mockResolvedValue([]);

    await expect(
      service.createOrder(companyId, customerId, {
        lines: [{ productId, qty: 1 }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.PRICE_UNAVAILABLE,
      }),
      status: HttpStatus.UNPROCESSABLE_ENTITY,
    });
    expect(salesService.create).not.toHaveBeenCalled();
  });

  it('reorders own order into new draft cloning lines', async () => {
    salesService.get.mockResolvedValue(ownOrder);
    const created = {
      ...ownOrder,
      id: 'reorder-id',
      number: 'SO-2026-0003',
      status: SalOrderStatus.DRAFT,
      notes: 'INTERNAL reorder',
    };
    salesService.create.mockResolvedValue(created);

    const dto = await service.reorderOrder(companyId, customerId, orderId, {
      requestedDate: '2026-09-20',
    });

    expect(salesService.create).toHaveBeenCalledWith(companyId, {
      customerId,
      warehouseId,
      requestedDate: '2026-09-20',
      preferredDriver: 'Karim',
      currency: 'TND',
      lines: [
        {
          productId,
          qty: 10,
          unitPrice: 5,
          discountPct: 0,
        },
      ],
      confirmAfter: false,
    });
    expect(dto.id).toBe('reorder-id');
    expect(JSON.stringify(dto)).not.toContain('INTERNAL');
  });

  it('rejects reorder IDOR for another customer order', async () => {
    salesService.get.mockResolvedValue({
      ...ownOrder,
      customerId: otherCustomerId,
    });

    await expect(
      service.reorderOrder(companyId, customerId, orderId),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      }),
    });
    expect(salesService.create).not.toHaveBeenCalled();
  });

  it('lists deliveries via membership customerId only', async () => {
    deliveryService.list.mockResolvedValue({
      items: [
        {
          id: 'ship-1',
          companyId,
          number: 'DLV-1',
          orderId: orderId,
          orderNumber: 'SO-1',
          customerId,
          customerCode: 'C-001',
          customerName: 'Atlas',
          warehouseId: 'wh-1',
          warehouseCode: 'MAIN',
          status: 'OUT',
          driverLabel: 'Karim',
          preferredDriver: null,
          failReason: null,
          version: 1,
          assignedAt: null,
          dispatchedAt: '2026-09-05T12:00:00.000Z',
          completedAt: null,
          createdAt: '2026-09-05T10:00:00.000Z',
          updatedAt: '2026-09-05T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });

    const result = await service.listDeliveries(companyId, customerId, {
      status: 'OUT',
    });

    expect(deliveryService.list).toHaveBeenCalledWith(companyId, {
      status: 'OUT',
      customerId,
    });
    expect(result.items[0].number).toBe('DLV-1');
    expect(result.items[0]).not.toHaveProperty('warehouseId');
    expect(result.items[0]).not.toHaveProperty('companyId');
  });

  it('returns 404 POR.NOT_FOUND for another customer delivery (IDOR)', async () => {
    deliveryService.get.mockResolvedValue({
      id: 'ship-1',
      companyId,
      number: 'DLV-1',
      orderId,
      orderNumber: 'SO-1',
      customerId: otherCustomerId,
      customerCode: 'X',
      customerName: 'Other',
      warehouseId: 'wh-1',
      warehouseCode: 'MAIN',
      status: 'OUT',
      driverLabel: 'Karim',
      preferredDriver: null,
      failReason: null,
      version: 1,
      assignedAt: null,
      dispatchedAt: null,
      completedAt: null,
      createdAt: '2026-09-05T10:00:00.000Z',
      updatedAt: '2026-09-05T10:00:00.000Z',
    });

    await expect(
      service.getDelivery(companyId, customerId, 'ship-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: CUSTOMER_PORTAL_ERROR_CODES.NOT_FOUND,
      }),
      status: HttpStatus.NOT_FOUND,
    });
  });
});

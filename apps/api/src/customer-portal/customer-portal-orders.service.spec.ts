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

  const ownOrder: SalesOrderDto = {
    id: orderId,
    companyId,
    number: 'SO-2026-0001',
    customerId,
    customerCode: 'C-001',
    customerName: 'Atlas',
    warehouseId: 'wh-1',
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
        productId: 'prod-1',
        productSku: 'BRIE',
        productName: 'Brie',
        qty: '10.000',
        unitPrice: '5.000',
        discountPct: '0',
        lineTotal: '50.000',
      },
    ],
  };

  let prisma: { salOrder: { count: jest.Mock } };
  let salesService: {
    list: jest.Mock;
    get: jest.Mock;
  };
  let service: CustomerPortalOrdersService;

  beforeEach(() => {
    prisma = {
      salOrder: { count: jest.fn().mockResolvedValue(2) },
    };
    salesService = {
      list: jest.fn(),
      get: jest.fn(),
    };
    service = new CustomerPortalOrdersService(
      prisma as never,
      salesService as unknown as SalesService,
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
    expect(shell.kpis.openOrders).toBe(2);
    expect(shell.message).toContain('P2');
  });
});

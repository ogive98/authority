import { InvMovementType, SalOrderStatus } from '@prisma/client';
import { ThunderDomainRegistrar } from './thunder-domain.registrar';

describe('ThunderDomainRegistrar', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const orderId = '55555555-5555-5555-5555-555555555555';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const warehouseId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';

  it('registers named domain consumers', () => {
    const registry = { register: jest.fn() };
    new ThunderDomainRegistrar(
      registry as never,
      { isEnabled: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    ).onModuleInit();

    expect(registry.register).toHaveBeenCalledWith(
      'inventory.reserveFromOrder',
      expect.any(Function),
      { consumes: ['sales.order.confirmed.v1'] },
    );
    expect(registry.register).toHaveBeenCalledWith(
      'finance.openItemFromDelivery',
      expect.any(Function),
      { consumes: ['delivery.shipment.delivered.v1'] },
    );
  });

  it('skips reserve when movement already exists (idempotent)', async () => {
    const inventory = { reserve: jest.fn() };
    const modules = { isEnabled: jest.fn().mockResolvedValue(true) };
    const prisma = {
      setValue: { findFirst: jest.fn().mockResolvedValue(null) },
      salOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          number: 'SO-1',
          companyId,
          customerId,
          warehouseId,
          status: SalOrderStatus.CONFIRMED,
          lines: [{ productId, qty: { toString: () => '10' }, lineNo: 1 }],
        }),
      },
      invMovement: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
    };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      modules as never,
      prisma as never,
      inventory as never,
      { ensureArForSalesOrder: jest.fn() } as never,
    );

    await registrar.onSalesConfirmedReserve({
      eventId: 'e1',
      eventType: 'sales.order.confirmed.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'sales',
      companyId,
      correlationId: 'c1',
      aggregateType: 'sal_order',
      aggregateId: orderId,
      payload: { orderId, customerId, warehouseId },
    });

    expect(inventory.reserve).not.toHaveBeenCalled();
    expect(prisma.invMovement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: InvMovementType.RESERVE,
          refId: orderId,
        }),
      }),
    );
  });

  it('creates AR on delivered via finance service', async () => {
    const finance = {
      ensureArForSalesOrder: jest.fn().mockResolvedValue({
        outcome: 'created',
        item: { number: 'FIN-1' },
      }),
    };
    const modules = { isEnabled: jest.fn().mockResolvedValue(true) };
    const prisma = {
      salOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          number: 'SO-1',
          customerId,
          amountTotal: { toString: () => '50' },
          currency: 'TND',
        }),
      },
    };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      modules as never,
      prisma as never,
      { reserve: jest.fn() } as never,
      finance as never,
    );

    await registrar.onShipmentDeliveredAr({
      eventId: 'e2',
      eventType: 'delivery.shipment.delivered.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'delivery',
      companyId,
      correlationId: 'c2',
      aggregateType: 'dlv_shipment',
      aggregateId: 'ship-1',
      payload: { orderId, customerId },
    });

    expect(finance.ensureArForSalesOrder).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({
        salesOrderId: orderId,
        customerId,
        amountTotal: 50,
      }),
    );
  });

  it('skips finance consumer when module disabled', async () => {
    const finance = { ensureArForSalesOrder: jest.fn() };
    const registrar = new ThunderDomainRegistrar(
      { register: jest.fn() } as never,
      { isEnabled: jest.fn().mockResolvedValue(false) } as never,
      {} as never,
      {} as never,
      finance as never,
    );
    await registrar.onShipmentDeliveredAr({
      eventId: 'e3',
      eventType: 'delivery.shipment.delivered.v1',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      source: 'delivery',
      companyId,
      correlationId: 'c3',
      aggregateType: 'dlv_shipment',
      aggregateId: 'ship-1',
      payload: { orderId, customerId },
    });
    expect(finance.ensureArForSalesOrder).not.toHaveBeenCalled();
  });
});

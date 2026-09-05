import { HttpStatus } from '@nestjs/common';
import { DlvShipmentStatus, Prisma, SalOrderStatus } from '@prisma/client';
import { DELIVERY_ERROR_CODES } from './delivery.constants';
import { DeliveryService } from './delivery.service';

describe('DeliveryService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const orderId = '55555555-5555-5555-5555-555555555555';
  const customerId = '22222222-2222-2222-2222-222222222222';
  const warehouseId = '33333333-3333-3333-3333-333333333333';
  const productId = '44444444-4444-4444-4444-444444444444';
  const shipmentId = '77777777-7777-7777-7777-777777777777';

  function build(opts?: {
    orderStatus?: SalOrderStatus;
    shipmentStatus?: DlvShipmentStatus;
    preferredDriver?: string | null;
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

    const order = {
      id: orderId,
      companyId,
      number: 'SO-2026-0001',
      customerId,
      warehouseId,
      status: opts?.orderStatus ?? SalOrderStatus.CONFIRMED,
      requestedDate: null,
      currency: 'TND',
      notes: null,
      preferredDriver: opts?.preferredDriver ?? 'Karim',
      amountTotal: new Prisma.Decimal(50),
      version: 0,
      confirmedAt: new Date(),
      cancelledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      lines: [line],
    };

    let shipment: {
      id: string;
      companyId: string;
      number: string;
      orderId: string;
      customerId: string;
      warehouseId: string;
      roundId: string | null;
      status: DlvShipmentStatus;
      driverLabel: string | null;
      preferredDriver: string | null;
      failReason: string | null;
      version: number;
      assignedAt: Date | null;
      dispatchedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      deletedAt: Date | null;
    } = {
      id: shipmentId,
      companyId,
      number: 'SH-2026-0001',
      orderId,
      customerId,
      warehouseId,
      roundId: null,
      status: opts?.shipmentStatus ?? DlvShipmentStatus.ASSIGNED,
      driverLabel: 'Karim',
      preferredDriver: 'Karim',
      failReason: null,
      version: 0,
      assignedAt: new Date(),
      dispatchedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const inventory = {
      issue: jest.fn().mockResolvedValue({}),
      release: jest.fn().mockResolvedValue({}),
      adjust: jest.fn().mockResolvedValue({}),
      reserve: jest.fn().mockResolvedValue({}),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prisma: any = {
      dlvShipment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockImplementation(({ where }: { where: { id?: string; orderId?: string } }) => {
          if (where?.orderId && !where?.id) {
            return Promise.resolve(null);
          }
          if (where?.id === shipmentId || !where?.id) {
            return Promise.resolve(shipment);
          }
          return Promise.resolve(shipment);
        }),
        findFirstOrThrow: jest.fn().mockImplementation(() => Promise.resolve(shipment)),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }: { data: Partial<typeof shipment> }) => {
          shipment = {
            ...shipment,
            ...data,
            id: shipmentId,
            status: (data.status as DlvShipmentStatus) ?? shipment.status,
          };
          return Promise.resolve(shipment);
        }),
        update: jest.fn().mockImplementation(({ data }: { data: Partial<typeof shipment> }) => {
          shipment = {
            ...shipment,
            ...data,
            status: (data.status as DlvShipmentStatus) ?? shipment.status,
          };
          return Promise.resolve(shipment);
        }),
        updateMany: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
          shipment = {
            ...shipment,
            status: (data.status as DlvShipmentStatus) ?? shipment.status,
            completedAt:
              (data.completedAt as Date | null | undefined) ?? shipment.completedAt,
            failReason:
              data.failReason !== undefined
                ? (data.failReason as string | null)
                : shipment.failReason,
            version: shipment.version + 1,
          };
          return Promise.resolve({ count: 1 });
        }),
      },
      salOrder: {
        findFirst: jest.fn().mockResolvedValue(order),
        findMany: jest.fn().mockResolvedValue([order]),
      },
      cusCustomer: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: customerId,
            code: 'C-ATLAS',
            party: { legalName: 'Atlas' },
          },
        ]),
      },
      invWarehouse: {
        findMany: jest.fn().mockResolvedValue([
          { id: warehouseId, code: 'MAIN' },
        ]),
      },
      setValue: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn(prisma),
      ),
    };

    const service = new DeliveryService(
      prisma as never,
      outbox as never,
      inventory as never,
    );

    return { service, prisma, inventory, outbox, order, getShipment: () => shipment };
  }

  it('creates shipment from confirmed order using preferred driver', async () => {
    const { service, inventory } = build({ preferredDriver: 'Sami' });
    const dto = await service.create(companyId, { orderId });
    expect(dto.status).toBe(DlvShipmentStatus.ASSIGNED);
    expect(dto.driverLabel).toBe('Sami');
    expect(inventory.issue).not.toHaveBeenCalled();
  });

  it('rejects non-confirmed order', async () => {
    const { service } = build({ orderStatus: SalOrderStatus.DRAFT });
    await expect(service.create(companyId, { orderId })).rejects.toMatchObject({
      status: HttpStatus.CONFLICT,
      response: { code: DELIVERY_ERROR_CODES.ORDER_NOT_CONFIRMED },
    });
  });

  it('completes shipment and issues stock', async () => {
    const { service, inventory, outbox } = build({
      shipmentStatus: DlvShipmentStatus.OUT,
    });
    const dto = await service.complete(companyId, shipmentId);
    expect(dto.status).toBe(DlvShipmentStatus.DELIVERED);
    expect(inventory.issue).toHaveBeenCalledWith(
      companyId,
      expect.objectContaining({ productId, qty: 10 }),
    );
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'delivery.shipment.delivered.v1',
      }),
    );
  });

  it('fails shipment and releases reserved stock', async () => {
    const { service, inventory, outbox } = build({
      shipmentStatus: DlvShipmentStatus.ASSIGNED,
    });
    const dto = await service.fail(companyId, shipmentId, {
      reason: 'Client absent',
    });
    expect(dto.status).toBe(DlvShipmentStatus.FAILED);
    expect(inventory.release).toHaveBeenCalled();
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'delivery.shipment.failed.v1',
      }),
    );
  });
});

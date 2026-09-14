import { HttpStatus } from '@nestjs/common';
import { DlvRoundStatus, FltVehicleStatus, Prisma } from '@prisma/client';
import { FleetService } from './fleet.service';
import { FleetException } from './fleet.exception';
import { FLEET_ERROR_CODES } from './fleet.constants';

function mockPrisma() {
  return {
    fltVehicle: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fltVehicleLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    fltAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    dlvRound: { findFirst: jest.fn(), update: jest.fn() },
    dlvShipment: { findMany: jest.fn() },
    salOrderLine: { findMany: jest.fn() },
    prdProduct: { findFirst: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        fltVehicle: {
          create: jest.fn(),
          update: jest.fn(),
        },
        fltAssignment: {
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findFirstOrThrow: jest.fn(),
        },
        dlvRound: {
          update: jest.fn(),
        },
        outbox: undefined,
      }),
    ),
  };
}

describe('FleetService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const vehicleId = '22222222-2222-2222-2222-222222222222';
  const roundId = '33333333-3333-3333-3333-333333333333';

  const vehicle = {
    id: vehicleId,
    companyId,
    code: 'CAM-01',
    plate: '123TU4567',
    capacityKg: new Prisma.Decimal(1000),
    cold: false,
    odometerKm: null,
    usualDriverLabel: null,
    nextServiceKm: null,
    nextServiceAt: null,
    status: FltVehicleStatus.ACTIVE,
    notes: null,
    version: 0,
    createdAt: new Date('2026-09-14T10:00:00Z'),
    updatedAt: new Date('2026-09-14T10:00:00Z'),
    deletedAt: null,
  };

  const round = {
    id: roundId,
    companyId,
    date: new Date('2026-09-14'),
    driverLabel: 'Ali',
    status: DlvRoundStatus.PLANNED,
    notes: null,
    version: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it('rejects dry vehicle when round has perishable products (FLT.NOT_COLD)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltVehicle.findFirst.mockResolvedValue(vehicle);
    prisma.dlvRound.findFirst.mockResolvedValue(round);
    prisma.dlvShipment.findMany.mockResolvedValue([{ orderId: 'o1' }]);
    prisma.salOrderLine.findMany.mockResolvedValue([{ productId: 'p1' }]);
    prisma.prdProduct.count.mockResolvedValue(1);

    await expect(
      service.createAssignment(companyId, {
        roundId,
        vehicleId,
        driverLabel: 'Ali',
      }),
    ).rejects.toMatchObject({
      response: { code: FLEET_ERROR_CODES.NOT_COLD },
      status: HttpStatus.CONFLICT,
    });
  });

  it('assign-hints requiresCold when perishable products present', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.dlvRound.findFirst.mockResolvedValue({ id: roundId });
    prisma.dlvShipment.findMany.mockResolvedValue([{ orderId: 'o1' }]);
    prisma.salOrderLine.findMany.mockResolvedValue([
      { productId: 'p1' },
      { productId: 'p2' },
    ]);
    prisma.prdProduct.count.mockResolvedValue(2);

    await expect(service.getAssignHints(companyId, roundId)).resolves.toEqual({
      roundId,
      requiresCold: true,
      perishableProductCount: 2,
    });
  });

  it('assign-hints requiresCold false when no perishable', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.dlvRound.findFirst.mockResolvedValue({ id: roundId });
    prisma.dlvShipment.findMany.mockResolvedValue([]);
    await expect(service.getAssignHints(companyId, roundId)).resolves.toEqual({
      roundId,
      requiresCold: false,
      perishableProductCount: 0,
    });
  });

  it('lists assignments filtered by vehicleId including cancelled', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltAssignment.findMany.mockResolvedValue([
      {
        id: '44444444-4444-4444-4444-444444444444',
        companyId,
        roundId,
        vehicleId,
        driverLabel: 'Ali',
        payloadKg: null,
        notes: null,
        assignedAt: new Date('2026-09-14T10:00:00Z'),
        version: 1,
        createdAt: new Date('2026-09-14T10:00:00Z'),
        updatedAt: new Date('2026-09-14T11:00:00Z'),
        deletedAt: new Date('2026-09-14T11:00:00Z'),
        vehicle,
        round,
      },
    ]);

    const res = await service.listAssignments(companyId, {
      vehicleId,
      includeCancelled: true,
    });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].cancelledAt).toBeTruthy();
    expect(prisma.fltAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId,
          vehicleId,
        }),
      }),
    );
  });

  it('rejects payload above capacity (FLT.CAPACITY)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltVehicle.findFirst.mockResolvedValue(vehicle);
    prisma.dlvRound.findFirst.mockResolvedValue(round);
    prisma.dlvShipment.findMany.mockResolvedValue([]);

    await expect(
      service.createAssignment(companyId, {
        roundId,
        vehicleId,
        driverLabel: 'Ali',
        payloadKg: 1500,
      }),
    ).rejects.toBeInstanceOf(FleetException);

    try {
      await service.createAssignment(companyId, {
        roundId,
        vehicleId,
        driverLabel: 'Ali',
        payloadKg: 1500,
      });
    } catch (e) {
      expect((e as FleetException).code).toBe(FLEET_ERROR_CODES.CAPACITY);
    }
  });

  it('cancels open assignment', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new FleetService(prisma as never, outbox as never);

    const assignment = {
      id: '44444444-4444-4444-4444-444444444444',
      companyId,
      roundId,
      vehicleId,
      driverLabel: 'Ali',
      payloadKg: null,
      notes: null,
      assignedAt: new Date(),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      vehicle,
      round,
    };

    prisma.fltAssignment.findFirst.mockResolvedValue(assignment);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        fltAssignment: {
          update: jest.fn().mockResolvedValue({
            ...assignment,
            deletedAt: new Date(),
            version: 1,
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.cancelAssignment(companyId, assignment.id);
    expect(result.id).toBe(assignment.id);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('copies assignment driver onto round (D255)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    const service = new FleetService(prisma as never, outbox as never);

    const assignment = {
      id: '44444444-4444-4444-4444-444444444444',
      companyId,
      roundId,
      vehicleId,
      driverLabel: 'Sami',
      payloadKg: null,
      notes: null,
      assignedAt: new Date(),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      vehicle,
      round: { ...round, driverLabel: 'Karim' },
    };

    prisma.fltAssignment.findFirst.mockResolvedValue(assignment);
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        dlvRound: {
          update: jest.fn().mockResolvedValue({
            ...round,
            driverLabel: 'Sami',
            version: 1,
          }),
        },
        fltAssignment: {
          findFirstOrThrow: jest.fn().mockResolvedValue({
            ...assignment,
            round: { ...round, driverLabel: 'Sami' },
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.copyDriverToRound(companyId, assignment.id);
    expect(result.roundDriverLabel).toBe('Sami');
    expect(result.assignment.round?.driverLabel).toBe('Sami');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'fleet.assignment.driver_copied.v1',
      }),
    );
  });

  it('rejects copy-driver when round is DONE', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltAssignment.findFirst.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      companyId,
      roundId,
      vehicleId,
      driverLabel: 'Sami',
      payloadKg: null,
      notes: null,
      assignedAt: new Date(),
      version: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      vehicle,
      round: { ...round, status: DlvRoundStatus.DONE },
    });

    await expect(
      service.copyDriverToRound(companyId, '44444444-4444-4444-4444-444444444444'),
    ).rejects.toMatchObject({
      response: { code: FLEET_ERROR_CODES.ROUND_DONE },
    });
  });

  it('rejects copy-driver when assignment cancelled', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltAssignment.findFirst.mockResolvedValue(null);

    await expect(
      service.copyDriverToRound(companyId, '44444444-4444-4444-4444-444444444444'),
    ).rejects.toMatchObject({
      response: { code: FLEET_ERROR_CODES.NOT_FOUND },
    });
  });

  it('creates oil-change log and bumps next service', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new FleetService(prisma as never, outbox as never);

    prisma.fltVehicle.findFirst.mockResolvedValue({
      ...vehicle,
      odometerKm: new Prisma.Decimal(50000),
      usualDriverLabel: 'Karim',
    });
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        fltVehicleLog: {
          create: jest.fn().mockResolvedValue({
            id: '55555555-5555-5555-5555-555555555555',
            companyId,
            vehicleId,
            kind: 'OIL_CHANGE',
            occurredAt: new Date('2026-09-14T10:00:00Z'),
            odometerKm: new Prisma.Decimal(50200),
            liters: null,
            amountTnd: null,
            notes: 'Castrol',
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        },
        fltVehicle: {
          update: jest.fn().mockResolvedValue({
            ...vehicle,
            odometerKm: new Prisma.Decimal(50200),
            usualDriverLabel: 'Karim',
            nextServiceKm: new Prisma.Decimal(60200),
            nextServiceAt: new Date('2027-03-14'),
            version: 1,
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.createVehicleLog(companyId, vehicleId, {
      kind: 'OIL_CHANGE',
      occurredAt: '2026-09-14T10:00:00.000Z',
      odometerKm: 50200,
      notes: 'Castrol',
    });

    expect(result.log.kind).toBe('OIL_CHANGE');
    expect(result.vehicle.odometerKm).toBe('50200');
    expect(result.vehicle.nextServiceKm).toBe('60200');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'fleet.vehicle.log_created.v1' }),
    );
  });
});

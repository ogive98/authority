import { HttpStatus } from '@nestjs/common';
import { MntAssetStatus, MntWoStatus, MntWoType } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceException } from './maintenance.exception';
import { MNT_ERROR_CODES } from './maintenance.constants';

function mockPrisma() {
  return {
    mntAsset: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    mntWo: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    fltVehicle: { findFirst: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        mntAsset: {
          create: jest.fn(),
          update: jest.fn(),
        },
        mntWo: {
          create: jest.fn(),
          update: jest.fn(),
        },
      };
      return fn(tx);
    }),
  };
}

describe('MaintenanceService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const assetId = '22222222-2222-2222-2222-222222222222';
  const vehicleId = '33333333-3333-3333-3333-333333333333';
  const woId = '44444444-4444-4444-4444-444444444444';

  const asset = {
    id: assetId,
    companyId,
    code: 'CUVE-01',
    label: 'Pasteurisateur',
    type: 'EQUIPMENT',
    status: MntAssetStatus.ONLINE,
    vehicleId: null,
    nextPreventiveAt: new Date('2026-09-01'),
    notes: null,
    version: 0,
    createdAt: new Date('2026-09-14T10:00:00Z'),
    updatedAt: new Date('2026-09-14T10:00:00Z'),
    deletedAt: null,
    vehicle: null,
  };

  it('marks asset down and emits event', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue(asset);
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        mntAsset: {
          update: jest.fn().mockResolvedValue({
            ...asset,
            status: MntAssetStatus.DOWN,
            version: 1,
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.markDown(companyId, assetId, 0);
    expect(result.status).toBe(MntAssetStatus.DOWN);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'maintenance.asset.down.v1',
      }),
    );
  });

  it('rejects markDown when already down (MNT.ASSET_DOWN)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue({
      ...asset,
      status: MntAssetStatus.DOWN,
    });

    await expect(service.markDown(companyId, assetId, 0)).rejects.toMatchObject(
      {
        response: { code: MNT_ERROR_CODES.ASSET_DOWN },
        status: HttpStatus.CONFLICT,
      },
    );
  });

  it('rejects unknown fleet vehicle (MNT.VEHICLE_NOT_FOUND)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.fltVehicle.findFirst.mockResolvedValue(null);

    await expect(
      service.createAsset(companyId, {
        code: 'CAM-MNT',
        label: 'Camion lien',
        type: 'VEHICLE',
        vehicleId,
      }),
    ).rejects.toMatchObject({
      response: { code: MNT_ERROR_CODES.VEHICLE_NOT_FOUND },
      status: HttpStatus.NOT_FOUND,
    });
  });

  it('creates work order', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue(asset);
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        mntWo: {
          create: jest.fn().mockResolvedValue({
            id: woId,
            companyId,
            assetId,
            type: MntWoType.BREAKDOWN,
            status: MntWoStatus.OPEN,
            title: 'Fuite joint',
            notes: null,
            openedAt: new Date(),
            doneAt: null,
            version: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            asset: {
              id: assetId,
              code: asset.code,
              label: asset.label,
              type: asset.type,
              status: asset.status,
            },
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.createWorkOrder(companyId, {
      assetId,
      type: 'BREAKDOWN',
      title: 'Fuite joint',
    });
    expect(result.status).toBe(MntWoStatus.OPEN);
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('rejects complete on already done WO (MNT.WO_DONE)', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntWo.findFirst.mockResolvedValue({
      id: woId,
      companyId,
      assetId,
      type: MntWoType.BREAKDOWN,
      status: MntWoStatus.DONE,
      title: 'Done',
      notes: null,
      openedAt: new Date(),
      doneAt: new Date(),
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.completeWorkOrder(companyId, woId),
    ).rejects.toBeInstanceOf(MaintenanceException);
    await expect(
      service.completeWorkOrder(companyId, woId),
    ).rejects.toMatchObject({
      response: { code: MNT_ERROR_CODES.WO_DONE },
    });
  });

  it('flags preventiveDue when nextPreventiveAt is past', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findMany.mockResolvedValue([asset]);

    const result = await service.listAssets(companyId);
    expect(result.items[0].preventiveDue).toBe(true);
  });

  it('filters assets by vehicleId', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findMany.mockResolvedValue([
      {
        ...asset,
        vehicleId,
        vehicle: {
          id: vehicleId,
          code: 'CAM-01',
          plate: '123-TN',
          deletedAt: null,
        },
      },
    ]);

    await service.listAssets(companyId, { vehicleId });
    expect(prisma.mntAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId, vehicleId }),
      }),
    );
  });

  it('openPreventiveWorkOrder creates PREVENTIVE WO', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue({ ...asset, vehicle: null });
    prisma.$transaction.mockImplementation(async (fn) => {
      const tx = {
        mntWo: {
          create: jest.fn().mockResolvedValue({
            id: woId,
            companyId,
            assetId,
            type: MntWoType.PREVENTIVE,
            status: MntWoStatus.OPEN,
            title: 'Préventif · CUVE-01 · 2026-09-01',
            notes: 'Ouverture ADV depuis date préventive 2026-09-01.',
            openedAt: new Date('2026-09-14T12:00:00Z'),
            doneAt: null,
            version: 0,
            createdAt: new Date('2026-09-14T12:00:00Z'),
            updatedAt: new Date('2026-09-14T12:00:00Z'),
            deletedAt: null,
            asset: {
              id: assetId,
              code: asset.code,
              label: asset.label,
              type: asset.type,
              status: asset.status,
            },
          }),
        },
      };
      return fn(tx);
    });

    const result = await service.openPreventiveWorkOrder(companyId, assetId);
    expect(result.type).toBe(MntWoType.PREVENTIVE);
    expect(result.status).toBe(MntWoStatus.OPEN);
    expect(result.title).toContain('Préventif');
    expect(outbox.enqueue).toHaveBeenCalled();
  });

  it('openPreventiveWorkOrder rejects missing asset', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue(null);

    await expect(
      service.openPreventiveWorkOrder(companyId, assetId),
    ).rejects.toMatchObject({
      response: { code: MNT_ERROR_CODES.NOT_FOUND },
    });
  });

  it('openPreventiveWorkOrder rejects asset without preventive date', async () => {
    const prisma = mockPrisma();
    const outbox = { enqueue: jest.fn() };
    const service = new MaintenanceService(prisma as never, outbox as never);

    prisma.mntAsset.findFirst.mockResolvedValue({
      ...asset,
      nextPreventiveAt: null,
      vehicle: null,
    });

    await expect(
      service.openPreventiveWorkOrder(companyId, assetId),
    ).rejects.toMatchObject({
      response: { code: MNT_ERROR_CODES.NO_PREVENTIVE_DATE },
    });
  });
});

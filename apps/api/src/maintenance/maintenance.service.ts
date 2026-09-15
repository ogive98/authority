import { HttpStatus, Injectable } from '@nestjs/common';
import {
  MntAsset,
  MntAssetStatus,
  MntWo,
  MntWoStatus,
  MntWoType,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MNT_ASSET_STATUSES,
  MNT_ERROR_CODES,
  MNT_EVENT_TYPES,
  MNT_WO_STATUSES,
  MNT_WO_TYPES,
} from './maintenance.constants';
import {
  CreateAssetDto,
  CreateWoDto,
  UpdateAssetDto,
} from './maintenance.dto';
import { MaintenanceException } from './maintenance.exception';

export type MaintenanceAssetDto = {
  id: string;
  companyId: string;
  code: string;
  label: string;
  type: string;
  status: MntAssetStatus;
  vehicleId: string | null;
  nextPreventiveAt: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  vehicle?: { id: string; code: string; plate: string } | null;
  preventiveDue: boolean;
};

export type MaintenanceWoDto = {
  id: string;
  companyId: string;
  assetId: string;
  type: MntWoType;
  status: MntWoStatus;
  title: string;
  notes: string | null;
  openedAt: string;
  doneAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  asset?: Pick<
    MaintenanceAssetDto,
    'id' | 'code' | 'label' | 'type' | 'status'
  >;
};

@Injectable()
export class MaintenanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listAssets(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      preventiveDue?: boolean;
      vehicleId?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: MaintenanceAssetDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.MntAssetWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.vehicleId?.trim()) {
      where.vehicleId = opts.vehicleId.trim();
    }
    if (opts.status?.trim()) {
      if (!isAssetStatus(opts.status.trim())) {
        throw new MaintenanceException(
          MNT_ERROR_CODES.INVALID_STATUS,
          'Invalid asset status filter.',
          HttpStatus.BAD_REQUEST,
        );
      }
      where.status = opts.status.trim() as MntAssetStatus;
    }
    if (opts.preventiveDue) {
      const today = startOfUtcDay(new Date());
      where.nextPreventiveAt = { lte: today };
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { label: { contains: q, mode: 'insensitive' } },
        { type: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.mntAsset.findMany({
      where,
      include: {
        vehicle: {
          select: { id: true, code: true, plate: true, deletedAt: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serializeAsset), nextCursor };
  }

  async getAsset(
    companyId: string,
    id: string,
  ): Promise<MaintenanceAssetDto> {
    return serializeAsset(await this.findActiveAsset(companyId, id, true));
  }

  async createAsset(
    companyId: string,
    dto: CreateAssetDto,
  ): Promise<MaintenanceAssetDto> {
    const code = dto.code.trim();
    const label = dto.label.trim();
    const vehicleId = await this.resolveVehicleId(companyId, dto.vehicleId);
    const nextPreventiveAt = parseOptionalDate(dto.nextPreventiveAt);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const asset = await tx.mntAsset.create({
          data: {
            companyId,
            code,
            label,
            type: dto.type,
            vehicleId,
            nextPreventiveAt,
            notes: dto.notes?.trim() || null,
            status: MntAssetStatus.ONLINE,
          },
          include: {
            vehicle: {
              select: { id: true, code: true, plate: true, deletedAt: true },
            },
          },
        });

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'mnt_asset',
          aggregateId: asset.id,
          eventType: MNT_EVENT_TYPES.ASSET_CREATED,
          payloadJson: {
            assetId: asset.id,
            code: asset.code,
            type: asset.type,
            vehicleId: asset.vehicleId,
            status: asset.status,
          },
        });

        return asset;
      });

      return serializeAsset(created);
    } catch (err) {
      if (err instanceof MaintenanceException) throw err;
      throwUniqueDup(err);
      throw err;
    }
  }

  async updateAsset(
    companyId: string,
    id: string,
    dto: UpdateAssetDto,
  ): Promise<MaintenanceAssetDto> {
    const existing = await this.findActiveAsset(companyId, id, false);
    if (existing.version !== dto.version) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.VERSION_CONFLICT,
        'Asset version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }

    const data: Prisma.MntAssetUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.nextPreventiveAt !== undefined) {
      data.nextPreventiveAt = parseOptionalDate(dto.nextPreventiveAt);
    }
    if (dto.vehicleId !== undefined) {
      const vehicleId = await this.resolveVehicleId(companyId, dto.vehicleId);
      data.vehicle = vehicleId
        ? { connect: { id: vehicleId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) {
      if (!isAssetStatus(dto.status)) {
        throw new MaintenanceException(
          MNT_ERROR_CODES.INVALID_STATUS,
          'Invalid asset status.',
          HttpStatus.BAD_REQUEST,
        );
      }
      data.status = dto.status as MntAssetStatus;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mntAsset.update({
        where: { id },
        data,
        include: {
          vehicle: {
            select: { id: true, code: true, plate: true, deletedAt: true },
          },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'mnt_asset',
        aggregateId: row.id,
        eventType: MNT_EVENT_TYPES.ASSET_UPDATED,
        payloadJson: {
          assetId: row.id,
          code: row.code,
          status: row.status,
          vehicleId: row.vehicleId,
          nextPreventiveAt: row.nextPreventiveAt
            ? toDateOnly(row.nextPreventiveAt)
            : null,
          version: row.version,
        },
      });

      if (
        dto.status === MntAssetStatus.DOWN &&
        existing.status !== MntAssetStatus.DOWN
      ) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'mnt_asset',
          aggregateId: row.id,
          eventType: MNT_EVENT_TYPES.ASSET_DOWN,
          payloadJson: { assetId: row.id, code: row.code },
        });
      }
      if (
        dto.status === MntAssetStatus.ONLINE &&
        existing.status !== MntAssetStatus.ONLINE
      ) {
        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'mnt_asset',
          aggregateId: row.id,
          eventType: MNT_EVENT_TYPES.ASSET_UP,
          payloadJson: { assetId: row.id, code: row.code },
        });
      }

      return row;
    });

    return serializeAsset(updated);
  }

  async markDown(
    companyId: string,
    id: string,
    version: number,
  ): Promise<MaintenanceAssetDto> {
    const existing = await this.findActiveAsset(companyId, id, false);
    if (existing.version !== version) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.VERSION_CONFLICT,
        'Asset version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }
    if (existing.status === MntAssetStatus.DOWN) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.ASSET_DOWN,
        'Asset is already down.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mntAsset.update({
        where: { id },
        data: {
          status: MntAssetStatus.DOWN,
          version: { increment: 1 },
        },
        include: {
          vehicle: {
            select: { id: true, code: true, plate: true, deletedAt: true },
          },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'mnt_asset',
        aggregateId: row.id,
        eventType: MNT_EVENT_TYPES.ASSET_DOWN,
        payloadJson: { assetId: row.id, code: row.code },
      });

      return row;
    });

    return serializeAsset(updated);
  }

  async markUp(
    companyId: string,
    id: string,
    version: number,
  ): Promise<MaintenanceAssetDto> {
    const existing = await this.findActiveAsset(companyId, id, false);
    if (existing.version !== version) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.VERSION_CONFLICT,
        'Asset version conflict.',
        HttpStatus.CONFLICT,
        { currentVersion: existing.version },
      );
    }
    if (existing.status === MntAssetStatus.ONLINE) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.ASSET_ONLINE,
        'Asset is already online.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mntAsset.update({
        where: { id },
        data: {
          status: MntAssetStatus.ONLINE,
          version: { increment: 1 },
        },
        include: {
          vehicle: {
            select: { id: true, code: true, plate: true, deletedAt: true },
          },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'mnt_asset',
        aggregateId: row.id,
        eventType: MNT_EVENT_TYPES.ASSET_UP,
        payloadJson: { assetId: row.id, code: row.code },
      });

      return row;
    });

    return serializeAsset(updated);
  }

  async listWorkOrders(
    companyId: string,
    opts: {
      assetId?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: MaintenanceWoDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.MntWoWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.assetId?.trim()) where.assetId = opts.assetId.trim();
    if (opts.status?.trim()) {
      if (!isWoStatus(opts.status.trim())) {
        throw new MaintenanceException(
          MNT_ERROR_CODES.INVALID_STATUS,
          'Invalid work-order status filter.',
          HttpStatus.BAD_REQUEST,
        );
      }
      where.status = opts.status.trim() as MntWoStatus;
    }

    const rows = await this.prisma.mntWo.findMany({
      where,
      include: {
        asset: {
          select: {
            id: true,
            code: true,
            label: true,
            type: true,
            status: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serializeWo), nextCursor };
  }

  async createWorkOrder(
    companyId: string,
    dto: CreateWoDto,
  ): Promise<MaintenanceWoDto> {
    const title = dto.title.trim();
    if (!title) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.INVALID_TITLE,
        'title is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!isWoType(dto.type)) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.INVALID_TYPE,
        'Invalid work-order type.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.findActiveAsset(companyId, dto.assetId, false);

    const created = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.mntWo.create({
        data: {
          companyId,
          assetId: dto.assetId,
          type: dto.type as MntWoType,
          title,
          notes: dto.notes?.trim() || null,
          status: MntWoStatus.OPEN,
        },
        include: {
          asset: {
            select: {
              id: true,
              code: true,
              label: true,
              type: true,
              status: true,
            },
          },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'mnt_wo',
        aggregateId: wo.id,
        eventType: MNT_EVENT_TYPES.WO_CREATED,
        payloadJson: {
          woId: wo.id,
          assetId: wo.assetId,
          type: wo.type,
          title: wo.title,
        },
      });

      return wo;
    });

    return serializeWo(created);
  }

  async openPreventiveWorkOrder(
    companyId: string,
    assetId: string,
  ): Promise<MaintenanceWoDto> {
    const asset = await this.findActiveAsset(companyId, assetId, true);
    if (!asset.nextPreventiveAt) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.NO_PREVENTIVE_DATE,
        'Asset has no nextPreventiveAt date.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const due = toDateOnly(asset.nextPreventiveAt);
    return this.createWorkOrder(companyId, {
      assetId,
      type: 'PREVENTIVE',
      title: `Préventif · ${asset.code} · ${due}`,
      notes: `Ouverture ADV depuis date préventive ${due}.`,
    });
  }

  async completeWorkOrder(
    companyId: string,
    id: string,
  ): Promise<MaintenanceWoDto> {
    const existing = await this.prisma.mntWo.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!existing) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.NOT_FOUND,
        'Work order not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.status === MntWoStatus.DONE) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.WO_DONE,
        'Work order is already done.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const wo = await tx.mntWo.update({
        where: { id },
        data: {
          status: MntWoStatus.DONE,
          doneAt: new Date(),
          version: { increment: 1 },
        },
        include: {
          asset: {
            select: {
              id: true,
              code: true,
              label: true,
              type: true,
              status: true,
            },
          },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'mnt_wo',
        aggregateId: wo.id,
        eventType: MNT_EVENT_TYPES.WO_DONE,
        payloadJson: {
          woId: wo.id,
          assetId: wo.assetId,
          type: wo.type,
        },
      });

      return wo;
    });

    return serializeWo(updated);
  }

  private async findActiveAsset(
    companyId: string,
    id: string,
    withVehicle: boolean,
  ) {
    const row = await this.prisma.mntAsset.findFirst({
      where: { id, companyId, deletedAt: null },
      ...(withVehicle
        ? {
            include: {
              vehicle: {
                select: {
                  id: true,
                  code: true,
                  plate: true,
                  deletedAt: true,
                },
              },
            },
          }
        : {}),
    });
    if (!row) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.NOT_FOUND,
        'Asset not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async resolveVehicleId(
    companyId: string,
    vehicleId: string | null | undefined,
  ): Promise<string | null> {
    if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
      return null;
    }
    const vehicle = await this.prisma.fltVehicle.findFirst({
      where: { id: vehicleId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!vehicle) {
      throw new MaintenanceException(
        MNT_ERROR_CODES.VEHICLE_NOT_FOUND,
        'Fleet vehicle not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return vehicle.id;
  }
}

type AssetRow = MntAsset & {
  vehicle?: {
    id: string;
    code: string;
    plate: string;
    deletedAt: Date | null;
  } | null;
};

type WoRow = MntWo & {
  asset?: {
    id: string;
    code: string;
    label: string;
    type: string;
    status: MntAssetStatus;
  };
};

function serializeAsset(row: AssetRow): MaintenanceAssetDto {
  const today = startOfUtcDay(new Date());
  const next = row.nextPreventiveAt
    ? startOfUtcDay(row.nextPreventiveAt)
    : null;
  const vehicle =
    row.vehicle && !row.vehicle.deletedAt
      ? {
          id: row.vehicle.id,
          code: row.vehicle.code,
          plate: row.vehicle.plate,
        }
      : null;

  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    label: row.label,
    type: row.type,
    status: row.status,
    vehicleId: row.vehicleId,
    nextPreventiveAt: row.nextPreventiveAt
      ? toDateOnly(row.nextPreventiveAt)
      : null,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    vehicle,
    preventiveDue: next !== null && next.getTime() <= today.getTime(),
  };
}

function serializeWo(row: WoRow): MaintenanceWoDto {
  return {
    id: row.id,
    companyId: row.companyId,
    assetId: row.assetId,
    type: row.type,
    status: row.status,
    title: row.title,
    notes: row.notes,
    openedAt: row.openedAt.toISOString(),
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    asset: row.asset
      ? {
          id: row.asset.id,
          code: row.asset.code,
          label: row.asset.label,
          type: row.asset.type,
          status: row.asset.status,
        }
      : undefined,
  };
}

function isAssetStatus(v: string): v is (typeof MNT_ASSET_STATUSES)[number] {
  return (MNT_ASSET_STATUSES as readonly string[]).includes(v);
}

function isWoStatus(v: string): v is (typeof MNT_WO_STATUSES)[number] {
  return (MNT_WO_STATUSES as readonly string[]).includes(v);
}

function isWoType(v: string): v is (typeof MNT_WO_TYPES)[number] {
  return (MNT_WO_TYPES as readonly string[]).includes(v);
}

function parseOptionalDate(raw: string | null | undefined): Date | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new MaintenanceException(
      MNT_ERROR_CODES.INVALID_STATUS,
      'Invalid nextPreventiveAt date.',
      HttpStatus.BAD_REQUEST,
    );
  }
  return startOfUtcDay(d);
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function toDateOnly(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

function throwUniqueDup(err: unknown): void {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    throw new MaintenanceException(
      MNT_ERROR_CODES.CODE_DUP,
      'Asset code already exists for this company.',
      HttpStatus.CONFLICT,
    );
  }
}

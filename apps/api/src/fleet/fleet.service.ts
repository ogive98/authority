import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DlvRoundStatus,
  FltAssignment,
  FltVehicle,
  FltVehicleStatus,
  Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  FLEET_ERROR_CODES,
  FLEET_EVENT_TYPES,
  FLEET_VEHICLE_STATUSES,
} from './fleet.constants';
import {
  CreateAssignmentDto,
  CreateVehicleDto,
  UpdateVehicleDto,
} from './fleet.dto';
import { FleetException } from './fleet.exception';

export type FleetVehicleDto = {
  id: string;
  companyId: string;
  code: string;
  plate: string;
  capacityKg: string | null;
  cold: boolean;
  odometerKm: string | null;
  status: FltVehicleStatus;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FleetAssignmentDto = {
  id: string;
  companyId: string;
  roundId: string;
  vehicleId: string;
  driverLabel: string;
  payloadKg: string | null;
  notes: string | null;
  assignedAt: string;
  cancelledAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  vehicle?: Pick<
    FleetVehicleDto,
    'id' | 'code' | 'plate' | 'cold' | 'capacityKg' | 'status'
  >;
  round?: {
    id: string;
    date: string;
    driverLabel: string;
    status: DlvRoundStatus;
  };
};

export type FleetAssignHintsDto = {
  roundId: string;
  requiresCold: boolean;
  perishableProductCount: number;
};

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listVehicles(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: FleetVehicleDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.FltVehicleWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts.status?.trim()) {
      if (!isVehicleStatus(opts.status.trim())) {
        throw new FleetException(
          FLEET_ERROR_CODES.INVALID_STATUS,
          'Invalid vehicle status filter.',
          HttpStatus.BAD_REQUEST,
        );
      }
      where.status = opts.status.trim() as FltVehicleStatus;
    }
    if (opts.q?.trim()) {
      const q = opts.q.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { plate: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.fltVehicle.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return { items: page.map(serializeVehicle), nextCursor };
  }

  async getVehicle(companyId: string, id: string): Promise<FleetVehicleDto> {
    return serializeVehicle(await this.findActiveVehicle(companyId, id));
  }

  async createVehicle(
    companyId: string,
    dto: CreateVehicleDto,
  ): Promise<FleetVehicleDto> {
    const code = dto.code.trim();
    const plate = normalizePlate(dto.plate);
    if (dto.capacityKg !== undefined && dto.capacityKg < 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_CAPACITY,
        'capacityKg must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.odometerKm !== undefined && dto.odometerKm < 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_ODOMETER,
        'odometerKm must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const vehicle = await tx.fltVehicle.create({
          data: {
            companyId,
            code,
            plate,
            capacityKg:
              dto.capacityKg !== undefined
                ? new Prisma.Decimal(dto.capacityKg)
                : null,
            cold: dto.cold ?? false,
            odometerKm:
              dto.odometerKm !== undefined
                ? new Prisma.Decimal(dto.odometerKm)
                : null,
            notes: dto.notes?.trim() || null,
            status: FltVehicleStatus.ACTIVE,
          },
        });

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'flt_vehicle',
          aggregateId: vehicle.id,
          eventType: FLEET_EVENT_TYPES.VEHICLE_CREATED,
          payloadJson: {
            vehicleId: vehicle.id,
            code: vehicle.code,
            plate: vehicle.plate,
            cold: vehicle.cold,
            status: vehicle.status,
          },
        });

        return vehicle;
      });

      return serializeVehicle(created);
    } catch (err) {
      if (err instanceof FleetException) throw err;
      throwUniqueDup(err);
      throw err;
    }
  }

  async updateVehicle(
    companyId: string,
    id: string,
    dto: UpdateVehicleDto,
  ): Promise<FleetVehicleDto> {
    const existing = await this.findActiveVehicle(companyId, id);
    if (existing.version !== dto.version) {
      throw new FleetException(
        FLEET_ERROR_CODES.VERSION_CONFLICT,
        'Vehicle version conflict.',
        HttpStatus.CONFLICT,
      );
    }

    if (dto.status !== undefined && !isVehicleStatus(dto.status)) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_STATUS,
        'Invalid vehicle status.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.capacityKg !== undefined && dto.capacityKg !== null && dto.capacityKg < 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_CAPACITY,
        'capacityKg must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.odometerKm !== undefined && dto.odometerKm !== null && dto.odometerKm < 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_ODOMETER,
        'odometerKm must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const vehicle = await tx.fltVehicle.update({
          where: { id },
          data: {
            ...(dto.plate !== undefined
              ? { plate: normalizePlate(dto.plate) }
              : {}),
            ...(dto.capacityKg !== undefined
              ? {
                  capacityKg:
                    dto.capacityKg === null
                      ? null
                      : new Prisma.Decimal(dto.capacityKg),
                }
              : {}),
            ...(dto.cold !== undefined ? { cold: dto.cold } : {}),
            ...(dto.odometerKm !== undefined
              ? {
                  odometerKm:
                    dto.odometerKm === null
                      ? null
                      : new Prisma.Decimal(dto.odometerKm),
                }
              : {}),
            ...(dto.notes !== undefined
              ? { notes: dto.notes?.trim() || null }
              : {}),
            ...(dto.status !== undefined
              ? { status: dto.status as FltVehicleStatus }
              : {}),
            version: { increment: 1 },
          },
        });

        await this.outbox.enqueue(tx, {
          companyId,
          aggregateType: 'flt_vehicle',
          aggregateId: vehicle.id,
          eventType: FLEET_EVENT_TYPES.VEHICLE_UPDATED,
          payloadJson: {
            vehicleId: vehicle.id,
            code: vehicle.code,
            plate: vehicle.plate,
            cold: vehicle.cold,
            status: vehicle.status,
            version: vehicle.version,
          },
        });

        return vehicle;
      });

      return serializeVehicle(updated);
    } catch (err) {
      if (err instanceof FleetException) throw err;
      throwUniqueDup(err);
      throw err;
    }
  }

  async listAssignments(
    companyId: string,
    opts: {
      roundId?: string;
      vehicleId?: string;
      includeCancelled?: boolean;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ items: FleetAssignmentDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Prisma.FltAssignmentWhereInput = {
      companyId,
      ...(opts.includeCancelled ? {} : { deletedAt: null }),
      ...(opts.roundId ? { roundId: opts.roundId } : {}),
      ...(opts.vehicleId ? { vehicleId: opts.vehicleId } : {}),
    };

    const rows = await this.prisma.fltAssignment.findMany({
      where,
      include: {
        vehicle: true,
        round: true,
      },
      orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor
        ? { cursor: { id: opts.cursor }, skip: 1 }
        : {}),
    });

    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit ? page[page.length - 1].id : null;
    return {
      items: page.map((row) =>
        serializeAssignment(row, row.vehicle, row.round),
      ),
      nextCursor,
    };
  }

  async getAssignHints(
    companyId: string,
    roundId: string,
  ): Promise<FleetAssignHintsDto> {
    const round = await this.prisma.dlvRound.findFirst({
      where: { id: roundId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!round) {
      throw new FleetException(
        FLEET_ERROR_CODES.ROUND_NOT_FOUND,
        'Delivery round not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const perishableProductCount = await this.countPerishableProducts(
      companyId,
      roundId,
    );
    return {
      roundId,
      requiresCold: perishableProductCount > 0,
      perishableProductCount,
    };
  }

  async createAssignment(
    companyId: string,
    dto: CreateAssignmentDto,
  ): Promise<FleetAssignmentDto> {
    const driverLabel = dto.driverLabel.trim();
    if (!driverLabel) {
      throw new FleetException(
        FLEET_ERROR_CODES.NOT_FOUND,
        'driverLabel is required.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.payloadKg !== undefined && dto.payloadKg < 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_PAYLOAD,
        'payloadKg must be >= 0.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const vehicle = await this.findActiveVehicle(companyId, dto.vehicleId);
    if (vehicle.status !== FltVehicleStatus.ACTIVE) {
      throw new FleetException(
        FLEET_ERROR_CODES.VEHICLE_NOT_ACTIVE,
        'Vehicle must be ACTIVE to assign.',
        HttpStatus.CONFLICT,
      );
    }

    const round = await this.prisma.dlvRound.findFirst({
      where: { id: dto.roundId, companyId, deletedAt: null },
    });
    if (!round) {
      throw new FleetException(
        FLEET_ERROR_CODES.ROUND_NOT_FOUND,
        'Delivery round not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (round.status === DlvRoundStatus.DONE) {
      throw new FleetException(
        FLEET_ERROR_CODES.ROUND_DONE,
        'Cannot assign vehicle to a DONE round.',
        HttpStatus.CONFLICT,
      );
    }

    await this.assertColdRequirement(companyId, dto.roundId, vehicle);
    this.assertCapacity(vehicle, dto.payloadKg);

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.fltAssignment.updateMany({
        where: {
          companyId,
          roundId: dto.roundId,
          deletedAt: null,
        },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });

      const assignment = await tx.fltAssignment.create({
        data: {
          companyId,
          roundId: dto.roundId,
          vehicleId: vehicle.id,
          driverLabel,
          payloadKg:
            dto.payloadKg !== undefined
              ? new Prisma.Decimal(dto.payloadKg)
              : null,
          notes: dto.notes?.trim() || null,
        },
        include: { vehicle: true, round: true },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'flt_assignment',
        aggregateId: assignment.id,
        eventType: FLEET_EVENT_TYPES.ASSIGNMENT_CREATED,
        payloadJson: {
          assignmentId: assignment.id,
          roundId: assignment.roundId,
          vehicleId: assignment.vehicleId,
          driverLabel: assignment.driverLabel,
        },
      });

      return assignment;
    });

    return serializeAssignment(created, created.vehicle, created.round);
  }

  async cancelAssignment(
    companyId: string,
    id: string,
  ): Promise<FleetAssignmentDto> {
    const existing = await this.prisma.fltAssignment.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { vehicle: true, round: true },
    });
    if (!existing) {
      throw new FleetException(
        FLEET_ERROR_CODES.NOT_FOUND,
        'Assignment not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const row = await tx.fltAssignment.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
        include: { vehicle: true, round: true },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'flt_assignment',
        aggregateId: row.id,
        eventType: FLEET_EVENT_TYPES.ASSIGNMENT_CANCELLED,
        payloadJson: {
          assignmentId: row.id,
          roundId: row.roundId,
          vehicleId: row.vehicleId,
        },
      });

      return row;
    });

    return serializeAssignment(cancelled, cancelled.vehicle, cancelled.round);
  }

  /**
   * ADV only — copy assignment.driverLabel onto dlv_round.driverLabel.
   * Never called automatically from createAssignment (D255).
   */
  async copyDriverToRound(
    companyId: string,
    assignmentId: string,
  ): Promise<{
    assignment: FleetAssignmentDto;
    roundDriverLabel: string;
  }> {
    const existing = await this.prisma.fltAssignment.findFirst({
      where: { id: assignmentId, companyId, deletedAt: null },
      include: { vehicle: true, round: true },
    });
    if (!existing) {
      throw new FleetException(
        FLEET_ERROR_CODES.NOT_FOUND,
        'Assignment not found.',
        HttpStatus.NOT_FOUND,
      );
    }

    const driverLabel = existing.driverLabel.trim();
    if (!driverLabel) {
      throw new FleetException(
        FLEET_ERROR_CODES.INVALID_DRIVER,
        'Assignment driverLabel is empty.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!existing.round || existing.round.deletedAt) {
      throw new FleetException(
        FLEET_ERROR_CODES.ROUND_NOT_FOUND,
        'Delivery round not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (existing.round.status === DlvRoundStatus.DONE) {
      throw new FleetException(
        FLEET_ERROR_CODES.ROUND_DONE,
        'Cannot copy driver onto a DONE round.',
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.dlvRound.update({
        where: { id: existing.roundId },
        data: {
          driverLabel,
          version: { increment: 1 },
        },
      });

      await this.outbox.enqueue(tx, {
        companyId,
        aggregateType: 'flt_assignment',
        aggregateId: existing.id,
        eventType: FLEET_EVENT_TYPES.ASSIGNMENT_DRIVER_COPIED,
        payloadJson: {
          assignmentId: existing.id,
          roundId: existing.roundId,
          driverLabel,
        },
      });

      return tx.fltAssignment.findFirstOrThrow({
        where: { id: existing.id },
        include: { vehicle: true, round: true },
      });
    });

    return {
      assignment: serializeAssignment(
        updated,
        updated.vehicle,
        updated.round,
      ),
      roundDriverLabel: driverLabel,
    };
  }

  private async assertColdRequirement(
    companyId: string,
    roundId: string,
    vehicle: FltVehicle,
  ): Promise<void> {
    if (vehicle.cold) return;
    const count = await this.countPerishableProducts(companyId, roundId);
    if (count > 0) {
      throw new FleetException(
        FLEET_ERROR_CODES.NOT_COLD,
        'Round includes perishable products — vehicle must be cold.',
        HttpStatus.CONFLICT,
      );
    }
  }

  private async countPerishableProducts(
    companyId: string,
    roundId: string,
  ): Promise<number> {
    const shipments = await this.prisma.dlvShipment.findMany({
      where: { companyId, roundId, deletedAt: null },
      select: { orderId: true },
    });
    const orderIds = [...new Set(shipments.map((s) => s.orderId))];
    if (orderIds.length === 0) return 0;

    const lines = await this.prisma.salOrderLine.findMany({
      where: { companyId, orderId: { in: orderIds } },
      select: { productId: true },
    });
    const productIds = [...new Set(lines.map((l) => l.productId))];
    if (productIds.length === 0) return 0;

    return this.prisma.prdProduct.count({
      where: {
        companyId,
        id: { in: productIds },
        perishable: true,
        deletedAt: null,
      },
    });
  }

  private assertCapacity(vehicle: FltVehicle, payloadKg?: number): void {
    if (payloadKg === undefined || vehicle.capacityKg == null) return;
    if (new Prisma.Decimal(payloadKg).greaterThan(vehicle.capacityKg)) {
      throw new FleetException(
        FLEET_ERROR_CODES.CAPACITY,
        'payloadKg exceeds vehicle capacityKg.',
        HttpStatus.CONFLICT,
        {
          capacityKg: vehicle.capacityKg.toString(),
          payloadKg: String(payloadKg),
        },
      );
    }
  }

  private async findActiveVehicle(
    companyId: string,
    id: string,
  ): Promise<FltVehicle> {
    const row = await this.prisma.fltVehicle.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new FleetException(
        FLEET_ERROR_CODES.NOT_FOUND,
        'Vehicle not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }
}

function serializeVehicle(row: FltVehicle): FleetVehicleDto {
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    plate: row.plate,
    capacityKg: row.capacityKg?.toString() ?? null,
    cold: row.cold,
    odometerKm: row.odometerKm?.toString() ?? null,
    status: row.status,
    notes: row.notes,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAssignment(
  row: FltAssignment,
  vehicle?: FltVehicle | null,
  round?: {
    id: string;
    date: Date;
    driverLabel: string;
    status: DlvRoundStatus;
  } | null,
): FleetAssignmentDto {
  return {
    id: row.id,
    companyId: row.companyId,
    roundId: row.roundId,
    vehicleId: row.vehicleId,
    driverLabel: row.driverLabel,
    payloadKg: row.payloadKg?.toString() ?? null,
    notes: row.notes,
    assignedAt: row.assignedAt.toISOString(),
    cancelledAt: row.deletedAt?.toISOString() ?? null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(vehicle
      ? {
          vehicle: {
            id: vehicle.id,
            code: vehicle.code,
            plate: vehicle.plate,
            cold: vehicle.cold,
            capacityKg: vehicle.capacityKg?.toString() ?? null,
            status: vehicle.status,
          },
        }
      : {}),
    ...(round
      ? {
          round: {
            id: round.id,
            date: round.date.toISOString().slice(0, 10),
            driverLabel: round.driverLabel,
            status: round.status,
          },
        }
      : {}),
  };
}

function normalizePlate(plate: string): string {
  return plate.trim().toUpperCase();
}

function isVehicleStatus(value: string): value is FltVehicleStatus {
  return (FLEET_VEHICLE_STATUSES as readonly string[]).includes(value);
}

function throwUniqueDup(err: unknown): void {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002'
  ) {
    const target = Array.isArray(err.meta?.target)
      ? (err.meta?.target as string[]).join(',')
      : String(err.meta?.target ?? '');
    if (target.includes('plate')) {
      throw new FleetException(
        FLEET_ERROR_CODES.PLATE_DUP,
        'Plate already exists for this company.',
        HttpStatus.CONFLICT,
      );
    }
    throw new FleetException(
      FLEET_ERROR_CODES.CODE_DUP,
      'Vehicle code already exists for this company.',
      HttpStatus.CONFLICT,
    );
  }
}

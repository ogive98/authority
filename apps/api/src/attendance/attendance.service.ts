import { HttpStatus, Injectable } from '@nestjs/common';
import {
  AttAbsenceStatus,
  AttAbsenceType,
  AttRhEventKind,
  HrEmployeeStatus,
  type AttAbsence,
  type AttRhEvent,
  type Prisma,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTENDANCE_ERROR_CODES,
  ATTENDANCE_EVENT_TYPES,
} from './attendance.constants';
import type { CreateAbsenceDto, CreateRhEventDto } from './attendance.dto';
import { AttendanceException } from './attendance.exception';

export type AttAbsenceDto = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeMatricule: string | null;
  employeeDisplayName: string | null;
  type: AttAbsenceType;
  status: AttAbsenceStatus;
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  requestedByUserId: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Unified calendar row (D220) — leave green / unpaid red / penalty orange. */
export type AttCalendarEntryDto = {
  id: string;
  source: 'absence' | 'rh_event';
  kind: 'LEAVE' | 'ABSENCE' | 'PENALTY';
  employeeId: string;
  startDate: string;
  endDate: string;
  motif: string | null;
  type: AttAbsenceType | null;
  status: AttAbsenceStatus | null;
  eventKind: AttRhEventKind | null;
};

export type AttRhEventDto = {
  id: string;
  companyId: string;
  employeeId: string;
  kind: AttRhEventKind;
  startDate: string;
  endDate: string;
  motif: string;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

type AbsenceWithEmployee = AttAbsence & {
  employee: { matricule: string; displayName: string } | null;
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listAbsences(
    companyId: string,
    opts?: { status?: AttAbsenceStatus; employeeId?: string },
  ): Promise<AttAbsenceDto[]> {
    const where: Prisma.AttAbsenceWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (opts?.status) where.status = opts.status;
    if (opts?.employeeId) where.employeeId = opts.employeeId;

    const rows = await this.prisma.attAbsence.findMany({
      where,
      include: {
        employee: { select: { matricule: true, displayName: true } },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return rows.map((r) => this.toDto(r));
  }

  /**
   * Calendar V0 (D220):
   * - LEAVE = APPROVED + (PAID|OTHER)
   * - ABSENCE = APPROVED + UNPAID
   * - PENALTY = AttRhEvent
   */
  async getCalendar(
    companyId: string,
    opts: { employeeId: string; from?: string; to?: string },
  ): Promise<AttCalendarEntryDto[]> {
    await this.assertEmployee(companyId, opts.employeeId);

    const from = opts.from ? startOfUtcDay(new Date(opts.from)) : null;
    const to = opts.to ? startOfUtcDay(new Date(opts.to)) : null;

    const absenceWhere: Prisma.AttAbsenceWhereInput = {
      companyId,
      employeeId: opts.employeeId,
      deletedAt: null,
      status: AttAbsenceStatus.APPROVED,
      type: {
        in: [AttAbsenceType.PAID, AttAbsenceType.UNPAID, AttAbsenceType.OTHER],
      },
    };
    if (from || to) {
      absenceWhere.AND = [
        ...(to ? [{ startDate: { lte: to } }] : []),
        ...(from ? [{ endDate: { gte: from } }] : []),
      ];
    }

    const eventWhere: Prisma.AttRhEventWhereInput = {
      companyId,
      employeeId: opts.employeeId,
      deletedAt: null,
    };
    if (from || to) {
      eventWhere.AND = [
        ...(to ? [{ startDate: { lte: to } }] : []),
        ...(from ? [{ endDate: { gte: from } }] : []),
      ];
    }

    const [absences, events] = await Promise.all([
      this.prisma.attAbsence.findMany({
        where: absenceWhere,
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
        take: 500,
      }),
      this.prisma.attRhEvent.findMany({
        where: eventWhere,
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
        take: 500,
      }),
    ]);

    const entries: AttCalendarEntryDto[] = [];
    for (const a of absences) {
      entries.push({
        id: a.id,
        source: 'absence',
        kind: a.type === AttAbsenceType.UNPAID ? 'ABSENCE' : 'LEAVE',
        employeeId: a.employeeId,
        startDate: isoDate(a.startDate),
        endDate: isoDate(a.endDate),
        motif: a.reason,
        type: a.type,
        status: a.status,
        eventKind: null,
      });
    }
    for (const e of events) {
      entries.push({
        id: e.id,
        source: 'rh_event',
        kind: 'PENALTY',
        employeeId: e.employeeId,
        startDate: isoDate(e.startDate),
        endDate: isoDate(e.endDate),
        motif: e.motif,
        type: null,
        status: null,
        eventKind: e.kind,
      });
    }
    entries.sort((a, b) => a.startDate.localeCompare(b.startDate));
    return entries;
  }

  async createRhEvent(
    companyId: string,
    dto: CreateRhEventDto,
    actorUserId: string,
  ): Promise<AttRhEventDto> {
    const motif = dto.motif.trim();
    if (!motif) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.MOTIF_REQUIRED,
        'Motif is required for RH events.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const startDate = startOfUtcDay(new Date(dto.startDate));
    const endDate = startOfUtcDay(new Date(dto.endDate));
    if (endDate.getTime() < startDate.getTime()) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.INVALID_DATES,
        'endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertEmployee(companyId, dto.employeeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attRhEvent.create({
        data: {
          companyId,
          employeeId: dto.employeeId,
          kind: dto.kind ?? AttRhEventKind.PENALTY,
          startDate,
          endDate,
          motif,
          notes: dto.notes?.trim() || null,
          createdByUserId: actorUserId,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: ATTENDANCE_EVENT_TYPES.RH_EVENT_CREATED,
        aggregateType: 'att_rh_event',
        aggregateId: row.id,
        payloadJson: {
          eventId: row.id,
          employeeId: row.employeeId,
          kind: row.kind,
          startDate: isoDate(row.startDate),
          endDate: isoDate(row.endDate),
        },
      });
      return row;
    });

    return this.toRhEventDto(created);
  }

  async createAbsence(
    companyId: string,
    dto: CreateAbsenceDto,
    actorUserId: string,
  ): Promise<AttAbsenceDto> {
    const startDate = startOfUtcDay(new Date(dto.startDate));
    const endDate = startOfUtcDay(new Date(dto.endDate));
    if (endDate.getTime() < startDate.getTime()) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.INVALID_DATES,
        'endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const employee = await this.assertEmployee(companyId, dto.employeeId);

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attAbsence.create({
        data: {
          companyId,
          employeeId: employee.id,
          type: dto.type,
          status: AttAbsenceStatus.REQUESTED,
          startDate,
          endDate,
          reason: dto.reason?.trim() || null,
          notes: dto.notes?.trim() || null,
          requestedByUserId: actorUserId,
        },
        include: {
          employee: { select: { matricule: true, displayName: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: ATTENDANCE_EVENT_TYPES.ABSENCE_REQUESTED,
        aggregateType: 'att_absence',
        aggregateId: row.id,
        payloadJson: {
          absenceId: row.id,
          employeeId: row.employeeId,
          type: row.type,
          startDate: isoDate(row.startDate),
          endDate: isoDate(row.endDate),
        },
      });
      return row;
    });

    return this.toDto(created);
  }

  async approveAbsence(
    companyId: string,
    id: string,
    actorUserId: string,
    notes?: string,
  ): Promise<AttAbsenceDto> {
    return this.decide(
      companyId,
      id,
      actorUserId,
      AttAbsenceStatus.APPROVED,
      ATTENDANCE_EVENT_TYPES.ABSENCE_APPROVED,
      notes,
    );
  }

  async rejectAbsence(
    companyId: string,
    id: string,
    actorUserId: string,
    notes?: string,
  ): Promise<AttAbsenceDto> {
    return this.decide(
      companyId,
      id,
      actorUserId,
      AttAbsenceStatus.REJECTED,
      ATTENDANCE_EVENT_TYPES.ABSENCE_REJECTED,
      notes,
    );
  }

  async cancelAbsence(
    companyId: string,
    id: string,
    actorUserId: string,
    canManage: boolean,
  ): Promise<AttAbsenceDto> {
    const current = await this.findAbsence(companyId, id);
    if (current.status !== AttAbsenceStatus.REQUESTED) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.INVALID_STATUS,
        'Only REQUESTED absences can be cancelled.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const isRequester = current.requestedByUserId === actorUserId;
    if (!isRequester && !canManage) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.FORBIDDEN,
        'Only the requester or a manager can cancel.',
        HttpStatus.FORBIDDEN,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attAbsence.update({
        where: { id: current.id },
        data: {
          status: AttAbsenceStatus.CANCELLED,
          version: { increment: 1 },
        },
        include: {
          employee: { select: { matricule: true, displayName: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: ATTENDANCE_EVENT_TYPES.ABSENCE_CANCELLED,
        aggregateType: 'att_absence',
        aggregateId: row.id,
        payloadJson: {
          absenceId: row.id,
          employeeId: row.employeeId,
          cancelledByUserId: actorUserId,
        },
      });
      return row;
    });

    return this.toDto(updated);
  }

  private async decide(
    companyId: string,
    id: string,
    actorUserId: string,
    next: Extract<AttAbsenceStatus, 'APPROVED' | 'REJECTED'>,
    eventType: string,
    notes?: string,
  ): Promise<AttAbsenceDto> {
    const current = await this.findAbsence(companyId, id);
    if (current.status !== AttAbsenceStatus.REQUESTED) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.INVALID_STATUS,
        'Only REQUESTED absences can be decided.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attAbsence.update({
        where: { id: current.id },
        data: {
          status: next,
          decidedByUserId: actorUserId,
          decidedAt: new Date(),
          notes:
            notes !== undefined
              ? notes.trim() || null
              : current.notes,
          version: { increment: 1 },
        },
        include: {
          employee: { select: { matricule: true, displayName: true } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType,
        aggregateType: 'att_absence',
        aggregateId: row.id,
        payloadJson: {
          absenceId: row.id,
          employeeId: row.employeeId,
          status: row.status,
          decidedByUserId: actorUserId,
        },
      });
      return row;
    });

    return this.toDto(updated);
  }

  private async assertEmployee(companyId: string, employeeId: string) {
    const employee = await this.prisma.hrEmployee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (employee.status !== HrEmployeeStatus.ACTIVE) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee must be ACTIVE.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return employee;
  }

  private async findAbsence(
    companyId: string,
    id: string,
  ): Promise<AbsenceWithEmployee> {
    const row = await this.prisma.attAbsence.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        employee: { select: { matricule: true, displayName: true } },
      },
    });
    if (!row) {
      throw new AttendanceException(
        ATTENDANCE_ERROR_CODES.NOT_FOUND,
        'Absence not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private toDto(row: AbsenceWithEmployee): AttAbsenceDto {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeMatricule: row.employee?.matricule ?? null,
      employeeDisplayName: row.employee?.displayName ?? null,
      type: row.type,
      status: row.status,
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
      reason: row.reason,
      notes: row.notes,
      requestedByUserId: row.requestedByUserId,
      decidedByUserId: row.decidedByUserId,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toRhEventDto(row: AttRhEvent): AttRhEventDto {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      kind: row.kind,
      startDate: isoDate(row.startDate),
      endDate: isoDate(row.endDate),
      motif: row.motif,
      notes: row.notes,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function isoDate(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

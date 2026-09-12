import { HttpStatus } from '@nestjs/common';
import {
  AttAbsenceStatus,
  AttAbsenceType,
  HrEmployeeStatus,
} from '@prisma/client';
import { ATTENDANCE_ERROR_CODES, ATTENDANCE_EVENT_TYPES } from './attendance.constants';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  const companyId = '11111111-1111-1111-1111-111111111111';
  const employeeId = '22222222-2222-2222-2222-222222222222';
  const userId = '33333333-3333-3333-3333-333333333333';
  const absenceId = '44444444-4444-4444-4444-444444444444';

  function build() {
    const employee = {
      id: employeeId,
      companyId,
      matricule: 'E-001',
      displayName: 'Amine Ben Ali',
      status: HrEmployeeStatus.ACTIVE,
      deletedAt: null,
    };

    const absence = {
      id: absenceId,
      companyId,
      employeeId,
      type: AttAbsenceType.PAID,
      status: AttAbsenceStatus.REQUESTED,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-05T00:00:00.000Z'),
      reason: 'Family',
      notes: null as string | null,
      requestedByUserId: userId,
      decidedByUserId: null as string | null,
      decidedAt: null as Date | null,
      version: 0,
      createdAt: new Date('2026-09-12T10:00:00.000Z'),
      updatedAt: new Date('2026-09-12T10:00:00.000Z'),
      deletedAt: null as Date | null,
      employee: {
        matricule: employee.matricule,
        displayName: employee.displayName,
      },
    };

    const prisma = {
      hrEmployee: {
        findFirst: jest.fn().mockResolvedValue(employee),
      },
      attAbsence: {
        findFirst: jest.fn().mockResolvedValue(absence),
        create: jest.fn().mockResolvedValue(absence),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            ...absence,
            ...data,
            status: data.status ?? absence.status,
            decidedByUserId: data.decidedByUserId ?? absence.decidedByUserId,
            decidedAt: data.decidedAt ?? absence.decidedAt,
            version: absence.version + 1,
            employee: absence.employee,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([
          { ...absence, status: AttAbsenceStatus.APPROVED },
        ]),
      },
      attRhEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: '55555555-5555-5555-5555-555555555555',
            companyId,
            employeeId,
            kind: 'PENALTY',
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            motif: data.motif,
            notes: data.notes ?? null,
            createdByUserId: data.createdByUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          }),
        ),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          attAbsence: prisma.attAbsence,
          attRhEvent: prisma.attRhEvent,
        }),
      ),
    };

    const outbox = { enqueue: jest.fn().mockResolvedValue({ id: 'o1' }) };
    const service = new AttendanceService(prisma as never, outbox as never);
    return { service, prisma, outbox, absence };
  }

  it('creates REQUESTED absence and emits outbox', async () => {
    const { service, outbox } = build();
    const dto = await service.createAbsence(
      companyId,
      {
        employeeId,
        type: AttAbsenceType.PAID,
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        reason: 'Family',
      },
      userId,
    );

    expect(dto.status).toBe(AttAbsenceStatus.REQUESTED);
    expect(dto.employeeId).toBe(employeeId);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: ATTENDANCE_EVENT_TYPES.ABSENCE_REQUESTED,
        aggregateType: 'att_absence',
      }),
    );
  });

  it('approves REQUESTED absence and emits outbox', async () => {
    const { service, outbox } = build();
    const dto = await service.approveAbsence(companyId, absenceId, userId);

    expect(dto.status).toBe(AttAbsenceStatus.APPROVED);
    expect(dto.decidedByUserId).toBe(userId);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: ATTENDANCE_EVENT_TYPES.ABSENCE_APPROVED,
      }),
    );
  });

  it('rejects endDate before startDate', async () => {
    const { service } = build();
    await expect(
      service.createAbsence(
        companyId,
        {
          employeeId,
          type: AttAbsenceType.UNPAID,
          startDate: '2026-10-05',
          endDate: '2026-10-01',
        },
        userId,
      ),
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: expect.objectContaining({
        code: ATTENDANCE_ERROR_CODES.INVALID_DATES,
      }),
    });
  });

  it('calendar maps APPROVED PAID to LEAVE', async () => {
    const { service } = build();
    const entries = await service.getCalendar(companyId, { employeeId });
    expect(entries).toEqual([
      expect.objectContaining({
        kind: 'LEAVE',
        type: AttAbsenceType.PAID,
        source: 'absence',
      }),
    ]);
  });

  it('creates PENALTY rh event with motif', async () => {
    const { service, outbox } = build();
    const dto = await service.createRhEvent(
      companyId,
      {
        employeeId,
        startDate: '2026-10-10',
        endDate: '2026-10-10',
        motif: 'Retard répété',
      },
      userId,
    );
    expect(dto.kind).toBe('PENALTY');
    expect(dto.motif).toBe('Retard répété');
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: ATTENDANCE_EVENT_TYPES.RH_EVENT_CREATED,
      }),
    );
  });
});

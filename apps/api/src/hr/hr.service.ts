import { HttpStatus, Injectable } from '@nestjs/common';
import {
  HrContractStatus,
  HrContractType,
  HrEmployeeStatus,
  Prisma,
  type HrContract,
  type HrEmployee,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES } from './hr.constants';
import type {
  CreateContractDto,
  CreateEmployeeDto,
  EndContractDto,
  PatchEmployeeDto,
} from './hr.dto';
import { HrException } from './hr.exception';

export type HrContractDto = {
  id: string;
  companyId: string;
  employeeId: string;
  number: string;
  type: HrContractType;
  status: HrContractStatus;
  startDate: string;
  endDate: string | null;
  /** Label only — never a CNSS/IRPP rate. Omitted without hr.wage.read. */
  wageRef: string | null;
  notes: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type HrEmployeeDto = {
  id: string;
  companyId: string;
  matricule: string;
  displayName: string;
  siteId: string | null;
  department: string | null;
  jobTitle: string | null;
  cnssNo: string | null;
  email: string | null;
  status: HrEmployeeStatus;
  hiredAt: string | null;
  leftAt: string | null;
  notes: string | null;
  version: number;
  contracts: HrContractDto[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async listEmployees(
    companyId: string,
    opts: {
      q?: string;
      status?: string;
      limit?: number;
      cursor?: string;
      includeWage?: boolean;
    } = {},
  ): Promise<{ items: HrEmployeeDto[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const status = opts.status?.trim().toUpperCase();

    const where: Prisma.HrEmployeeWhereInput = {
      companyId,
      deletedAt: null,
      ...(status &&
      Object.values(HrEmployeeStatus).includes(status as HrEmployeeStatus)
        ? { status: status as HrEmployeeStatus }
        : {}),
      ...(q
        ? {
            OR: [
              { matricule: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { department: { contains: q, mode: 'insensitive' } },
              { cnssNo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.hrEmployee.findMany({
      where,
      include: {
        contracts: {
          where: { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
    return {
      items: page.map((r) => this.toEmployeeDto(r, opts.includeWage === true)),
      nextCursor,
    };
  }

  async getEmployee(
    companyId: string,
    id: string,
    includeWage = false,
  ): Promise<HrEmployeeDto> {
    const row = await this.findEmployee(companyId, id);
    return this.toEmployeeDto(row, includeWage);
  }

  async createEmployee(
    companyId: string,
    dto: CreateEmployeeDto,
    includeWage = false,
  ): Promise<HrEmployeeDto> {
    const matricule = dto.matricule.trim().toUpperCase();
    const existing = await this.prisma.hrEmployee.findFirst({
      where: { companyId, matricule, deletedAt: null },
    });
    if (existing) {
      throw new HrException(
        HR_ERROR_CODES.MATRICULE_EXISTS,
        'Matricule already exists for this company.',
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrEmployee.create({
        data: {
          companyId,
          matricule,
          displayName: dto.displayName.trim(),
          siteId: dto.siteId ?? null,
          department: dto.department?.trim() || null,
          jobTitle: dto.jobTitle?.trim() || null,
          cnssNo: dto.cnssNo?.trim() || null,
          email: dto.email?.trim() || null,
          hiredAt: dto.hiredAt ? startOfUtcDay(new Date(dto.hiredAt)) : null,
          notes: dto.notes?.trim() || null,
          status: HrEmployeeStatus.ACTIVE,
        },
        include: {
          contracts: { where: { deletedAt: null } },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.EMPLOYEE_CREATED,
        aggregateType: 'hr_employee',
        aggregateId: row.id,
        payloadJson: {
          employeeId: row.id,
          matricule: row.matricule,
        },
      });
      return row;
    });

    return this.toEmployeeDto(created, includeWage);
  }

  async patchEmployee(
    companyId: string,
    id: string,
    dto: PatchEmployeeDto,
    includeWage = false,
  ): Promise<HrEmployeeDto> {
    await this.findEmployee(companyId, id);

    const data: Prisma.HrEmployeeUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }
    if (dto.siteId !== undefined) data.siteId = dto.siteId;
    if (dto.department !== undefined) {
      data.department = dto.department?.trim() || null;
    }
    if (dto.jobTitle !== undefined) {
      data.jobTitle = dto.jobTitle?.trim() || null;
    }
    if (dto.cnssNo !== undefined) data.cnssNo = dto.cnssNo?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === HrEmployeeStatus.LEFT && dto.leftAt === undefined) {
        data.leftAt = utcToday();
      }
    }
    if (dto.leftAt !== undefined) {
      data.leftAt = dto.leftAt
        ? startOfUtcDay(new Date(dto.leftAt))
        : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrEmployee.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        include: {
          contracts: {
            where: { deletedAt: null },
            orderBy: { startDate: 'desc' },
          },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.EMPLOYEE_UPDATED,
        aggregateType: 'hr_employee',
        aggregateId: row.id,
        payloadJson: { employeeId: row.id, status: row.status },
      });
      return row;
    });

    return this.toEmployeeDto(updated, includeWage);
  }

  async createContract(
    companyId: string,
    dto: CreateContractDto,
    includeWage = false,
  ): Promise<HrContractDto> {
    const employee = await this.findEmployee(companyId, dto.employeeId);
    if (employee.status === HrEmployeeStatus.LEFT) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_STATUS,
        'Cannot add a contract to a left employee.',
        HttpStatus.CONFLICT,
      );
    }

    const startDate = startOfUtcDay(new Date(dto.startDate));
    const endDate = dto.endDate
      ? startOfUtcDay(new Date(dto.endDate))
      : null;
    if (endDate && endDate < startDate) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_DATES,
        'Contract endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const number = await this.nextContractNumber(companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrContract.create({
        data: {
          companyId,
          employeeId: dto.employeeId,
          number,
          type: dto.type,
          status: HrContractStatus.ACTIVE,
          startDate,
          endDate,
          wageRef: dto.wageRef?.trim() || null,
          notes: dto.notes?.trim() || null,
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.CONTRACT_CREATED,
        aggregateType: 'hr_contract',
        aggregateId: row.id,
        payloadJson: {
          contractId: row.id,
          employeeId: row.employeeId,
          number: row.number,
          type: row.type,
        },
      });
      return row;
    });

    return this.toContractDto(created, includeWage);
  }

  async endContract(
    companyId: string,
    id: string,
    dto: EndContractDto,
    includeWage = false,
  ): Promise<HrContractDto> {
    const row = await this.prisma.hrContract.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.CONTRACT_NOT_FOUND,
        'Contract not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (row.status === HrContractStatus.ENDED) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_STATUS,
        'Contract already ended.',
        HttpStatus.CONFLICT,
      );
    }

    const endDate = dto.endDate
      ? startOfUtcDay(new Date(dto.endDate))
      : utcToday();
    if (endDate < row.startDate) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_DATES,
        'Contract endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.hrContract.update({
        where: { id },
        data: {
          status: HrContractStatus.ENDED,
          endDate,
          version: { increment: 1 },
        },
      });
      await this.outbox.enqueue(tx, {
        companyId,
        eventType: HR_EVENT_TYPES.CONTRACT_ENDED,
        aggregateType: 'hr_contract',
        aggregateId: next.id,
        payloadJson: {
          contractId: next.id,
          employeeId: next.employeeId,
          endDate: next.endDate?.toISOString().slice(0, 10) ?? null,
        },
      });
      return next;
    });

    return this.toContractDto(updated, includeWage);
  }

  private async findEmployee(
    companyId: string,
    id: string,
  ): Promise<HrEmployee & { contracts: HrContract[] }> {
    const row = await this.prisma.hrEmployee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        contracts: {
          where: { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
      },
    });
    if (!row) {
      throw new HrException(
        HR_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    return row;
  }

  private async nextContractNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CTR-${year}-`;
    const count = await this.prisma.hrContract.count({
      where: { companyId, number: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private toEmployeeDto(
    row: HrEmployee & { contracts: HrContract[] },
    includeWage: boolean,
  ): HrEmployeeDto {
    return {
      id: row.id,
      companyId: row.companyId,
      matricule: row.matricule,
      displayName: row.displayName,
      siteId: row.siteId,
      department: row.department,
      jobTitle: row.jobTitle,
      cnssNo: row.cnssNo,
      email: row.email,
      status: row.status,
      hiredAt: row.hiredAt ? toDateOnly(row.hiredAt) : null,
      leftAt: row.leftAt ? toDateOnly(row.leftAt) : null,
      notes: row.notes,
      version: row.version,
      contracts: row.contracts.map((c) => this.toContractDto(c, includeWage)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toContractDto(row: HrContract, includeWage: boolean): HrContractDto {
    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      number: row.number,
      type: row.type,
      status: row.status,
      startDate: toDateOnly(row.startDate),
      endDate: row.endDate ? toDateOnly(row.endDate) : null,
      wageRef: includeWage ? row.wageRef : null,
      notes: row.notes,
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function utcToday(): Date {
  return startOfUtcDay(new Date());
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

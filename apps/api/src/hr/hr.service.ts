import { HttpStatus, Injectable } from '@nestjs/common';
import {
  DocLinkType,
  DocVisibility,
  HrContractStatus,
  HrContractType,
  HrEmployeeStatus,
  IamUserStatus,
  Prisma,
  type HrContract,
  type HrEmployee,
  type HrJobTitle,
  type IamUser,
} from '@prisma/client';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { HR_ERROR_CODES, HR_EVENT_TYPES, isHrImageMime } from './hr.constants';
import { assertTunisianCin } from './hr-print-merge';
import type {
  CreateContractDto,
  CreateEmployeeDto,
  EndContractDto,
  PatchContractDto,
  PatchEmployeeDto,
} from './hr.dto';
import { HrException } from './hr.exception';
import { JobTitleService } from './job-title.service';
import { HrIdentityProvisionService } from './hr-identity-provision.service';

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
  /** Human wage base TND — omitted without hr.wage.read. */
  wageBase: string | null;
  notes: string | null;
  pdfDocumentId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type HrLinkedUserDto = {
  id: string;
  email: string;
  displayName: string;
  status: IamUserStatus;
};

export type HrLinkableUserDto = {
  id: string;
  email: string;
  displayName: string;
  status: IamUserStatus;
  roleCode: string | null;
  /** True if already linked to another employee in this company. */
  linkedEmployeeId: string | null;
};

export type HrSiteDto = {
  id: string;
  code: string;
  type: string;
  status: string;
};

export type HrEmployeeDto = {
  id: string;
  companyId: string;
  matricule: string;
  displayName: string;
  siteId: string | null;
  site: HrSiteDto | null;
  department: string | null;
  jobTitleId: string | null;
  /** Resolved catalog name — not free text. */
  jobTitle: string | null;
  cnssNo: string | null;
  cinNo: string | null;
  address: string | null;
  bankName: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  email: string | null;
  userId: string | null;
  linkedUser: HrLinkedUserDto | null;
  status: HrEmployeeStatus;
  hiredAt: string | null;
  leftAt: string | null;
  notes: string | null;
  taxChefDeFamille: boolean | null;
  taxEnfantCount: number | null;
  photoDocumentId: string | null;
  attestationPdfDocumentId: string | null;
  version: number;
  contracts: HrContractDto[];
  createdAt: string;
  updatedAt: string;
};

/** D219 — create response may include one-time provisional password. */
export type CreateEmployeeResult = HrEmployeeDto & {
  provisionalPassword?: string;
  provision?: {
    userId: string;
    email: string;
    emailSent: boolean;
    smtpConfigured: boolean;
  };
};

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly jobTitles: JobTitleService,
    private readonly identityProvision: HrIdentityProvisionService,
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
              { cinNo: { contains: q, mode: 'insensitive' } },
              { jobTitle: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
      ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
    };

    const rows = await this.prisma.hrEmployee.findMany({
      where,
      include: employeeInclude,
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
  ): Promise<CreateEmployeeResult> {
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

    const jobTitleId = await this.jobTitles.resolveAssignableId(
      companyId,
      dto.jobTitleId ?? null,
    );

    if (dto.siteId) {
      await this.assertSiteInCompany(companyId, dto.siteId);
    }

    let cinNo: string | null = null;
    try {
      cinNo = assertTunisianCin(dto.cinNo);
    } catch {
      throw new HrException(
        HR_ERROR_CODES.CIN_INVALID,
        'CIN must be exactly 8 digits when set.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const provisionLogin = dto.provisionLogin === true;
    const emailRaw = dto.email?.trim() || '';
    if (provisionLogin && !emailRaw) {
      throw new HrException(
        HR_ERROR_CODES.EMAIL_REQUIRED,
        'Email is required to provision Identity login.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let provision:
      | {
          userId: string;
          email: string;
          provisionalPassword: string;
          emailSent: boolean;
          smtpConfigured: boolean;
        }
      | undefined;

    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrEmployee.create({
        data: {
          companyId,
          matricule,
          displayName: dto.displayName.trim(),
          siteId: dto.siteId ?? null,
          department: dto.department?.trim() || null,
          jobTitleId: jobTitleId ?? null,
          cnssNo: dto.cnssNo?.trim() || null,
          cinNo,
          address: dto.address?.trim() || null,
          bankName: dto.bankName?.trim() || null,
          bankAgency: dto.bankAgency?.trim() || null,
          bankAccount: dto.bankAccount?.trim() || null,
          email: emailRaw || null,
          hiredAt: dto.hiredAt ? startOfUtcDay(new Date(dto.hiredAt)) : null,
          notes: dto.notes?.trim() || null,
          status: HrEmployeeStatus.ACTIVE,
        },
        include: employeeInclude,
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

      if (provisionLogin) {
        provision = await this.identityProvision.provisionForNewEmployee({
          companyId,
          employeeId: row.id,
          email: emailRaw,
          displayName: dto.displayName.trim(),
          tx,
        });
        return tx.hrEmployee.findFirstOrThrow({
          where: { id: row.id },
          include: employeeInclude,
        });
      }

      return row;
    });

    const dtoOut = this.toEmployeeDto(created, includeWage);
    if (!provision) return dtoOut;
    return {
      ...dtoOut,
      provisionalPassword: provision.provisionalPassword,
      provision: {
        userId: provision.userId,
        email: provision.email,
        emailSent: provision.emailSent,
        smtpConfigured: provision.smtpConfigured,
      },
    };
  }

  async patchEmployee(
    companyId: string,
    id: string,
    dto: PatchEmployeeDto,
    includeWage = false,
  ): Promise<HrEmployeeDto> {
    const current = await this.findEmployee(companyId, id);

    const data: Prisma.HrEmployeeUpdateInput = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName.trim();
    }
    if (dto.siteId !== undefined) {
      if (dto.siteId === null) {
        data.site = { disconnect: true };
      } else {
        await this.assertSiteInCompany(companyId, dto.siteId);
        data.site = { connect: { id: dto.siteId } };
      }
    }
    if (dto.department !== undefined) {
      data.department = dto.department?.trim() || null;
    }
    if (dto.jobTitleId !== undefined) {
      const nextId = await this.jobTitles.resolveAssignableId(
        companyId,
        dto.jobTitleId,
        current.jobTitleId,
      );
      data.jobTitle =
        nextId === null ? { disconnect: true } : { connect: { id: nextId } };
    }
    if (dto.cnssNo !== undefined) data.cnssNo = dto.cnssNo?.trim() || null;
    if (dto.cinNo !== undefined) {
      try {
        data.cinNo = assertTunisianCin(dto.cinNo);
      } catch {
        throw new HrException(
          HR_ERROR_CODES.CIN_INVALID,
          'CIN must be exactly 8 digits when set.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.bankName !== undefined) data.bankName = dto.bankName?.trim() || null;
    if (dto.bankAgency !== undefined) {
      data.bankAgency = dto.bankAgency?.trim() || null;
    }
    if (dto.bankAccount !== undefined) {
      data.bankAccount = dto.bankAccount?.trim() || null;
    }
    if (dto.email !== undefined) data.email = dto.email?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.hiredAt !== undefined) {
      data.hiredAt = dto.hiredAt
        ? startOfUtcDay(new Date(dto.hiredAt))
        : null;
    }
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
    if (dto.taxChefDeFamille !== undefined) {
      data.taxChefDeFamille = dto.taxChefDeFamille;
    }
    if (dto.taxEnfantCount !== undefined) {
      data.taxEnfantCount = dto.taxEnfantCount;
    }
    if (dto.photoDocumentId !== undefined) {
      if (dto.photoDocumentId === null) {
        data.photoDocument = { disconnect: true };
      } else {
        const doc = await this.prisma.docDocument.findFirst({
          where: {
            id: dto.photoDocumentId,
            companyId,
            deletedAt: null,
            visibility: DocVisibility.INTERNAL,
            linkType: DocLinkType.HR_EMPLOYEE,
            linkId: id,
          },
        });
        if (!doc || !isHrImageMime(doc.mime)) {
          throw new HrException(
            HR_ERROR_CODES.PHOTO_INVALID,
            'Photo must be an INTERNAL image linked to this employee.',
            HttpStatus.BAD_REQUEST,
          );
        }
        data.photoDocument = { connect: { id: doc.id } };
      }
    }
    if (dto.userId !== undefined) {
      if (dto.userId === null) {
        data.user = { disconnect: true };
      } else {
        await this.assertLinkableUser(companyId, dto.userId, id);
        data.user = { connect: { id: dto.userId } };
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.hrEmployee.update({
        where: { id },
        data: { ...data, version: { increment: 1 } },
        include: employeeInclude,
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
          wageBase:
            dto.wageBase != null && Number.isFinite(dto.wageBase)
              ? new Prisma.Decimal(dto.wageBase)
              : null,
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

  async patchContract(
    companyId: string,
    id: string,
    dto: PatchContractDto,
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
    if (row.status !== HrContractStatus.ACTIVE) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_STATUS,
        'Only ACTIVE contracts can be edited.',
        HttpStatus.CONFLICT,
      );
    }
    const data: Prisma.HrContractUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.startDate !== undefined) {
      data.startDate = startOfUtcDay(new Date(dto.startDate));
    }
    if (dto.endDate !== undefined) {
      data.endDate = dto.endDate
        ? startOfUtcDay(new Date(dto.endDate))
        : null;
    }
    if (dto.wageRef !== undefined) {
      data.wageRef = dto.wageRef?.trim() || null;
    }
    if (dto.wageBase !== undefined) {
      data.wageBase =
        dto.wageBase != null && Number.isFinite(dto.wageBase)
          ? new Prisma.Decimal(dto.wageBase)
          : null;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }

    const nextStart =
      dto.startDate !== undefined
        ? startOfUtcDay(new Date(dto.startDate))
        : row.startDate;
    const nextEnd =
      dto.endDate !== undefined
        ? dto.endDate
          ? startOfUtcDay(new Date(dto.endDate))
          : null
        : row.endDate;
    if (nextEnd && nextEnd < nextStart) {
      throw new HrException(
        HR_ERROR_CODES.INVALID_DATES,
        'Contract endDate must be on or after startDate.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updated = await this.prisma.hrContract.update({
      where: { id },
      data,
    });
    return this.toContractDto(updated, includeWage);
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
  ): Promise<EmployeeRow> {
    const row = await this.prisma.hrEmployee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: employeeInclude,
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

  private toEmployeeDto(row: EmployeeRow, includeWage: boolean): HrEmployeeDto {
    return {
      id: row.id,
      companyId: row.companyId,
      matricule: row.matricule,
      displayName: row.displayName,
      siteId: row.siteId,
      site: row.site
        ? {
            id: row.site.id,
            code: row.site.code,
            type: row.site.type,
            status: row.site.status,
          }
        : null,
      department: row.department,
      jobTitleId: row.jobTitleId,
      jobTitle: row.jobTitle?.name ?? null,
      cnssNo: row.cnssNo,
      cinNo: row.cinNo,
      address: row.address,
      bankName: row.bankName,
      bankAgency: row.bankAgency,
      bankAccount: row.bankAccount,
      email: row.email,
      userId: row.userId,
      linkedUser: row.user
        ? {
            id: row.user.id,
            email: row.user.email,
            displayName: row.user.displayName,
            status: row.user.status,
          }
        : null,
      status: row.status,
      hiredAt: row.hiredAt ? toDateOnly(row.hiredAt) : null,
      leftAt: row.leftAt ? toDateOnly(row.leftAt) : null,
      notes: row.notes,
      taxChefDeFamille: row.taxChefDeFamille,
      taxEnfantCount: row.taxEnfantCount,
      photoDocumentId: row.photoDocumentId,
      attestationPdfDocumentId: row.attestationPdfDocumentId,
      version: row.version,
      contracts: row.contracts.map((c) => this.toContractDto(c, includeWage)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Company Identity users that HR can link — gated by hr.employee.write,
   * not identity.user.manage (D213).
   */
  async listLinkableUsers(
    companyId: string,
    opts: { q?: string; limit?: number } = {},
  ): Promise<{ items: HrLinkableUserDto[] }> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const q = opts.q?.trim();
    const assignments = await this.prisma.orgUserAssignment.findMany({
      where: {
        companyId,
        user: {
          deletedAt: null,
          ...(q
            ? {
                OR: [
                  { email: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
      },
      take: limit,
      orderBy: { user: { displayName: 'asc' } },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
          },
        },
      },
    });
    const userIds = assignments.map((a) => a.userId);
    const linked = userIds.length
      ? await this.prisma.hrEmployee.findMany({
          where: {
            companyId,
            deletedAt: null,
            userId: { in: userIds },
          },
          select: { id: true, userId: true },
        })
      : [];
    const linkedByUser = new Map(
      linked
        .filter((e): e is { id: string; userId: string } => e.userId != null)
        .map((e) => [e.userId, e.id]),
    );
    return {
      items: assignments.map((a) => ({
        id: a.user.id,
        email: a.user.email,
        displayName: a.user.displayName,
        status: a.user.status,
        roleCode: a.roleCode,
        linkedEmployeeId: linkedByUser.get(a.userId) ?? null,
      })),
    };
  }

  private async assertLinkableUser(
    companyId: string,
    userId: string,
    employeeId: string,
  ) {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId },
      include: {
        user: { select: { id: true, deletedAt: true } },
      },
    });
    if (!assignment?.user || assignment.user.deletedAt) {
      throw new HrException(
        HR_ERROR_CODES.USER_INVALID,
        'User must be an Identity account assigned to this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const other = await this.prisma.hrEmployee.findFirst({
      where: {
        companyId,
        userId,
        deletedAt: null,
        NOT: { id: employeeId },
      },
      select: { id: true, matricule: true },
    });
    if (other) {
      throw new HrException(
        HR_ERROR_CODES.USER_ALREADY_LINKED,
        `User already linked to employee ${other.matricule}.`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Site must belong to the same company and not be soft-deleted (D214). */
  private async assertSiteInCompany(companyId: string, siteId: string) {
    const site = await this.prisma.orgSite.findFirst({
      where: { id: siteId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!site) {
      throw new HrException(
        HR_ERROR_CODES.SITE_INVALID,
        'Site must belong to this company.',
        HttpStatus.BAD_REQUEST,
      );
    }
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
      wageBase:
        includeWage && row.wageBase != null
          ? row.wageBase.toFixed(3)
          : null,
      notes: row.notes,
      pdfDocumentId: row.pdfDocumentId,
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

const employeeInclude = {
  jobTitle: true,
  site: {
    select: {
      id: true,
      code: true,
      type: true,
      status: true,
    },
  },
  user: {
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
    },
  },
  contracts: {
    where: { deletedAt: null },
    orderBy: { startDate: 'desc' as const },
  },
} satisfies Prisma.HrEmployeeInclude;

type EmployeeRow = HrEmployee & {
  jobTitle: HrJobTitle | null;
  site: {
    id: string;
    code: string;
    type: string;
    status: string;
  } | null;
  user: Pick<IamUser, 'id' | 'email' | 'displayName' | 'status'> | null;
  contracts: HrContract[];
};

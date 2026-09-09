import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IamGrantSubject,
  IamUserStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { PasswordService } from './password.service';
import {
  BUSINESS_ROLE_CODES,
  type CreateCompanyUserDto,
  type UpdateCompanyUserDto,
} from './users.dto';

export type CompanyUserDto = {
  id: string;
  email: string;
  displayName: string;
  status: IamUserStatus;
  locale: string;
  timezone: string;
  mfaEnabled: boolean;
  roleCode: string | null;
  assignmentId: string;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  listRoles() {
    return {
      items: [
        {
          code: 'admin',
          label: 'Administrateur',
          description: 'Gestion utilisateurs + droits opérationnels',
        },
        {
          code: 'operator',
          label: 'Opérateur',
          description: 'Usage métier sans administration des comptes',
        },
      ],
    };
  }

  async list(
    companyId: string,
    opts: { q?: string } = {},
  ): Promise<{ items: CompanyUserDto[] }> {
    const q = opts.q?.trim();
    const rows = await this.prisma.orgUserAssignment.findMany({
      where: {
        companyId,
        deletedAt: null,
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
      include: { user: true },
      orderBy: [{ user: { displayName: 'asc' } }],
      take: 200,
    });

    return { items: rows.map((r) => this.toDto(r)) };
  }

  async get(companyId: string, userId: string): Promise<CompanyUserDto> {
    const row = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId, deletedAt: null, user: { deletedAt: null } },
      include: { user: true },
    });
    if (!row) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.USER_NOT_FOUND,
        'User not found in this company.',
        HttpStatus.NOT_FOUND,
      );
    }
    return this.toDto(row);
  }

  async create(
    companyId: string,
    dto: CreateCompanyUserDto,
  ): Promise<CompanyUserDto> {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.iamUser.findUnique({
      where: { email },
    });
    if (existing && !existing.deletedAt) {
      const already = await this.prisma.orgUserAssignment.findFirst({
        where: {
          companyId,
          userId: existing.id,
          deletedAt: null,
        },
      });
      if (already) {
        throw new IdentityException(
          IDENTITY_ERROR_CODES.VALIDATION,
          'User already assigned to this company.',
          HttpStatus.CONFLICT,
        );
      }
      const assignment = await this.prisma.orgUserAssignment.create({
        data: {
          companyId,
          userId: existing.id,
          roleCode: dto.roleCode,
        },
        include: { user: true },
      });
      return this.toDto(assignment);
    }

    const passwordHash = await this.passwords.hash(dto.password);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.iamUser.create({
          data: {
            email,
            displayName: dto.displayName.trim(),
            status: IamUserStatus.ACTIVE,
            passwordHash,
          },
        });
        const assignment = await tx.orgUserAssignment.create({
          data: {
            companyId,
            userId: user.id,
            roleCode: dto.roleCode,
          },
          include: { user: true },
        });
        await tx.iamGrant.create({
          data: {
            permissionKey: 'identity.self.read',
            effect: 'ALLOW',
            subjectType: IamGrantSubject.USER,
            subjectId: user.id,
          },
        });
        await tx.iamGrant.create({
          data: {
            permissionKey: 'identity.session.revoke',
            effect: 'ALLOW',
            subjectType: IamGrantSubject.USER,
            subjectId: user.id,
          },
        });
        return assignment;
      });
      return this.toDto(created);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new IdentityException(
          IDENTITY_ERROR_CODES.VALIDATION,
          'Email already exists.',
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }
  }

  async update(
    companyId: string,
    userId: string,
    dto: UpdateCompanyUserDto,
  ): Promise<CompanyUserDto> {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId, deletedAt: null, user: { deletedAt: null } },
      include: { user: true },
    });
    if (!assignment) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.USER_NOT_FOUND,
        'User not found in this company.',
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.roleCode && !BUSINESS_ROLE_CODES.includes(dto.roleCode)) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Invalid roleCode.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash =
      dto.password !== undefined
        ? await this.passwords.hash(dto.password)
        : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.displayName !== undefined ||
        dto.status !== undefined ||
        passwordHash !== undefined
      ) {
        await tx.iamUser.update({
          where: { id: userId },
          data: {
            ...(dto.displayName !== undefined
              ? { displayName: dto.displayName.trim() }
              : {}),
            ...(dto.status !== undefined
              ? { status: dto.status as IamUserStatus }
              : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
          },
        });
      }
      if (dto.roleCode !== undefined) {
        await tx.orgUserAssignment.update({
          where: { id: assignment.id },
          data: { roleCode: dto.roleCode },
        });
      }
    });

    return this.get(companyId, userId);
  }

  private toDto(row: {
    id: string;
    roleCode: string | null;
    user: {
      id: string;
      email: string;
      displayName: string;
      status: IamUserStatus;
      locale: string;
      timezone: string;
      mfaEnabled: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }): CompanyUserDto {
    return {
      id: row.user.id,
      email: row.user.email,
      displayName: row.user.displayName,
      status: row.user.status,
      locale: row.user.locale,
      timezone: row.user.timezone,
      mfaEnabled: row.user.mfaEnabled,
      roleCode: row.roleCode,
      assignmentId: row.id,
      createdAt: row.user.createdAt.toISOString(),
      updatedAt: row.user.updatedAt.toISOString(),
    };
  }
}

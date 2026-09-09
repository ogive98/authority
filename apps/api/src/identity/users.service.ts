import { HttpStatus, Injectable } from '@nestjs/common';
import {
  IamGrantEffect,
  IamGrantSubject,
  IamLifecycleStatus,
  IamUserStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '../audit/audit.constants';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { PasswordService } from './password.service';
import { InviteSettingsResolver } from './invite-settings.resolver';
import {
  BUSINESS_ROLE_CATALOGUE,
  BUSINESS_ROLE_CODES,
} from './business-roles';
import type {
  CreateCompanyUserDto,
  SetUserGrantsDto,
  UpdateCompanyUserDto,
} from './users.dto';
import {
  PERMISSION_CATALOGUE,
  isCataloguedPermission,
} from '../permissions/permission.constants';

const PROTECTED_USER_KEYS = new Set([
  'identity.self.read',
  'identity.session.revoke',
]);

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
  /** Present when status=INVITED and invite not consumed (D121). */
  inviteExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
    private readonly inviteSettings: InviteSettingsResolver,
  ) {}

  private async assertPasswordLength(
    companyId: string,
    password: string,
  ): Promise<void> {
    const cfg = await this.inviteSettings.resolve(companyId);
    if (password.length < cfg.minPasswordLength) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        `Mot de passe : ${cfg.minPasswordLength} caractères minimum.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  listRoles() {
    return {
      items: BUSINESS_ROLE_CATALOGUE.map((r) => ({ ...r })),
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
      include: {
        user: {
          include: {
            invite: {
              select: { expiresAt: true, consumedAt: true },
            },
          },
        },
      },
      orderBy: [{ user: { displayName: 'asc' } }],
      take: 200,
    });

    return { items: rows.map((r) => this.toDto(r)) };
  }

  async get(companyId: string, userId: string): Promise<CompanyUserDto> {
    const row = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId, deletedAt: null, user: { deletedAt: null } },
      include: {
        user: {
          include: {
            invite: {
              select: { expiresAt: true, consumedAt: true },
            },
          },
        },
      },
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
    await this.assertPasswordLength(companyId, dto.password);
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
    actorUserId?: string,
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

    if (
      dto.roleCode &&
      !(BUSINESS_ROLE_CODES as readonly string[]).includes(dto.roleCode)
    ) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Invalid roleCode.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (dto.password !== undefined) {
      await this.assertPasswordLength(companyId, dto.password);
    }

    const passwordHash =
      dto.password !== undefined
        ? await this.passwords.hash(dto.password)
        : undefined;

    const effectivePasswordHash =
      passwordHash !== undefined
        ? passwordHash
        : assignment.user.passwordHash;

    let effectiveStatus: IamUserStatus | undefined =
      dto.status !== undefined
        ? (dto.status as IamUserStatus)
        : undefined;

    // Admin sets a password on an Invité → activate (consume invite below).
    if (
      passwordHash !== undefined &&
      assignment.user.status === IamUserStatus.INVITED &&
      (effectiveStatus === undefined ||
        effectiveStatus === IamUserStatus.INVITED ||
        effectiveStatus === IamUserStatus.ACTIVE)
    ) {
      effectiveStatus = IamUserStatus.ACTIVE;
    }

    const nextStatus = effectiveStatus ?? assignment.user.status;
    if (
      nextStatus === IamUserStatus.ACTIVE &&
      !effectivePasswordHash
    ) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Impossible d’activer sans mot de passe (invitation ou saisie admin).',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.displayName !== undefined ||
        effectiveStatus !== undefined ||
        passwordHash !== undefined
      ) {
        await tx.iamUser.update({
          where: { id: userId },
          data: {
            ...(dto.displayName !== undefined
              ? { displayName: dto.displayName.trim() }
              : {}),
            ...(effectiveStatus !== undefined
              ? { status: effectiveStatus }
              : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
          },
        });
      }
      if (
        assignment.user.status === IamUserStatus.INVITED &&
        nextStatus === IamUserStatus.ACTIVE
      ) {
        await tx.iamInvite.updateMany({
          where: { userId, consumedAt: null },
          data: {
            consumedAt: new Date(),
            tokenHash: `consumed-admin:${userId}`,
          },
        });
        await this.audit.append(tx, {
          companyId,
          actorUserId,
          action: AUDIT_ACTIONS.identityUserInviteAdminActivate,
          entityType: AUDIT_ENTITY_TYPES.iamUser,
          entityId: userId,
          afterJson: {
            email: assignment.user.email,
            status: IamUserStatus.ACTIVE,
            via: 'admin_password',
            passwordSet: passwordHash !== undefined,
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

  async getGrants(companyId: string, userId: string) {
    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: { companyId, userId, deletedAt: null, user: { deletedAt: null } },
    });
    if (!assignment) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.USER_NOT_FOUND,
        'User not found in this company.',
        HttpStatus.NOT_FOUND,
      );
    }

    const userGrants = await this.prisma.iamGrant.findMany({
      where: {
        subjectType: IamGrantSubject.USER,
        subjectId: userId,
        status: IamLifecycleStatus.ACTIVE,
        effect: IamGrantEffect.ALLOW,
        OR: [{ companyId }, { companyId: null }],
      },
      orderBy: [{ permissionKey: 'asc' }],
    });

    const roleCode = assignment.roleCode;
    const roleGrants = roleCode
      ? await this.prisma.iamGrant.findMany({
          where: {
            subjectType: IamGrantSubject.ROLE,
            subjectId: roleCode,
            status: IamLifecycleStatus.ACTIVE,
            effect: IamGrantEffect.ALLOW,
            OR: [{ companyId }, { companyId: null }],
          },
          orderBy: [{ permissionKey: 'asc' }],
        })
      : [];

    const userAllow = userGrants.map((g) => g.permissionKey);
    const roleAllow = roleGrants.map((g) => g.permissionKey);
    const companyUserAllow = userGrants
      .filter((g) => g.companyId === companyId)
      .map((g) => g.permissionKey);

    return {
      userId,
      roleCode,
      catalog: [...PERMISSION_CATALOGUE],
      userAllow,
      roleAllow,
      companyUserAllow,
      protectedKeys: [...PROTECTED_USER_KEYS],
    };
  }

  async setGrants(
    companyId: string,
    userId: string,
    dto: SetUserGrantsDto,
  ) {
    await this.get(companyId, userId);

    const next = [
      ...new Set(
        (dto.allowKeys ?? []).filter(
          (k) =>
            isCataloguedPermission(k) &&
            !PROTECTED_USER_KEYS.has(k),
        ),
      ),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.iamGrant.deleteMany({
        where: {
          subjectType: IamGrantSubject.USER,
          subjectId: userId,
          companyId,
          effect: IamGrantEffect.ALLOW,
          permissionKey: { notIn: [...PROTECTED_USER_KEYS] },
        },
      });

      if (next.length > 0) {
        await tx.iamGrant.createMany({
          data: next.map((permissionKey) => ({
            permissionKey,
            effect: IamGrantEffect.ALLOW,
            subjectType: IamGrantSubject.USER,
            subjectId: userId,
            companyId,
            status: IamLifecycleStatus.ACTIVE,
          })),
        });
      }
    });

    return this.getGrants(companyId, userId);
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
      invite?: {
        expiresAt: Date;
        consumedAt: Date | null;
      } | null;
    };
  }): CompanyUserDto {
    const invite = row.user.invite;
    const inviteExpiresAt =
      row.user.status === IamUserStatus.INVITED &&
      invite &&
      !invite.consumedAt
        ? invite.expiresAt.toISOString()
        : null;
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
      inviteExpiresAt,
      createdAt: row.user.createdAt.toISOString(),
      updatedAt: row.user.updatedAt.toISOString(),
    };
  }
}

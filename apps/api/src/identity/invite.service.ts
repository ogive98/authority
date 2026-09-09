import { createHash, randomBytes } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { IamGrantSubject, IamUserStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
} from '../audit/audit.constants';
import { IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { PasswordService } from './password.service';
import {
  BUSINESS_ROLE_CODES,
  type BusinessRoleCode,
} from './business-roles';
import type { CompanyUserDto } from './users.service';

const INVITE_TTL_DAYS = 7;

export type InviteIssueResult = {
  user: CompanyUserDto;
  inviteUrl: string | null;
  mailtoHref: string | null;
  expiresAt: string | null;
  alreadyActive: boolean;
};

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  async invite(
    companyId: string,
    dto: { email: string; displayName: string; roleCode: BusinessRoleCode },
    actorUserId?: string,
  ): Promise<InviteIssueResult> {
    if (!(BUSINESS_ROLE_CODES as readonly string[]).includes(dto.roleCode)) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Invalid roleCode.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName.trim();
    const existing = await this.prisma.iamUser.findUnique({
      where: { email },
    });

    if (existing && !existing.deletedAt) {
      const already = await this.prisma.orgUserAssignment.findFirst({
        where: { companyId, userId: existing.id, deletedAt: null },
      });

      if (already) {
        if (existing.status === IamUserStatus.INVITED) {
          return this.issueForAssignment(
            already.id,
            companyId,
            existing,
            actorUserId,
            'reinvite',
          );
        }
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

      if (
        existing.status === IamUserStatus.ACTIVE &&
        existing.passwordHash
      ) {
        return {
          user: this.toUserDto(assignment),
          inviteUrl: null,
          mailtoHref: null,
          expiresAt: null,
          alreadyActive: true,
        };
      }

      return this.issueForAssignment(
        assignment.id,
        companyId,
        existing,
        actorUserId,
        'invite',
      );
    }

    const { raw, hash, expiresAt } = this.newToken();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.iamUser.create({
          data: {
            email,
            displayName,
            status: IamUserStatus.INVITED,
            passwordHash: null,
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
        await tx.iamInvite.create({
          data: {
            userId: user.id,
            companyId,
            tokenHash: hash,
            expiresAt,
          },
        });
        await this.audit.append(tx, {
          companyId,
          actorUserId,
          action: AUDIT_ACTIONS.identityUserInvite,
          entityType: AUDIT_ENTITY_TYPES.iamUser,
          entityId: user.id,
          afterJson: {
            email,
            displayName,
            roleCode: dto.roleCode,
            expiresAt: expiresAt.toISOString(),
          },
        });
        return assignment;
      });
      return this.toIssue(created, raw, expiresAt);
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

  async reinvite(
    companyId: string,
    userId: string,
    actorUserId?: string,
  ): Promise<InviteIssueResult> {
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
    if (assignment.user.status !== IamUserStatus.INVITED) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Seuls les comptes Invité peuvent être renvoyés.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.issueForAssignment(
      assignment.id,
      companyId,
      assignment.user,
      actorUserId,
      'reinvite',
    );
  }

  async peek(rawToken: string): Promise<{
    email: string;
    displayName: string;
    expiresAt: string;
  }> {
    const invite = await this.findValidInvite(rawToken);
    return {
      email: invite.user.email,
      displayName: invite.user.displayName,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async accept(rawToken: string, password: string): Promise<{ email: string }> {
    if (password.length < 8) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Mot de passe : 8 caractères minimum.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const invite = await this.findValidInvite(rawToken);
    const passwordHash = await this.passwords.hash(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.iamUser.update({
        where: { id: invite.userId },
        data: {
          status: IamUserStatus.ACTIVE,
          passwordHash,
        },
      });
      await tx.iamInvite.update({
        where: { id: invite.id },
        data: {
          consumedAt: new Date(),
          tokenHash: `consumed:${invite.id}`,
        },
      });
      await this.audit.append(tx, {
        companyId: invite.companyId,
        actorUserId: invite.userId,
        action: AUDIT_ACTIONS.identityUserInviteAccept,
        entityType: AUDIT_ENTITY_TYPES.iamUser,
        entityId: invite.userId,
        afterJson: {
          email: invite.user.email,
          status: IamUserStatus.ACTIVE,
          passwordSet: true,
          via: 'token',
        },
      });
    });
    return { email: invite.user.email };
  }

  private async issueForAssignment(
    assignmentId: string,
    companyId: string,
    user: { id: string; email: string; displayName: string },
    actorUserId: string | undefined,
    kind: 'invite' | 'reinvite',
  ): Promise<InviteIssueResult> {
    const { raw, hash, expiresAt } = this.newToken();
    await this.prisma.$transaction(async (tx) => {
      await tx.iamInvite.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          companyId,
          tokenHash: hash,
          expiresAt,
        },
        update: {
          companyId,
          tokenHash: hash,
          expiresAt,
          consumedAt: null,
        },
      });
      await this.audit.append(tx, {
        companyId,
        actorUserId,
        action:
          kind === 'reinvite'
            ? AUDIT_ACTIONS.identityUserReinvite
            : AUDIT_ACTIONS.identityUserInvite,
        entityType: AUDIT_ENTITY_TYPES.iamUser,
        entityId: user.id,
        afterJson: {
          email: user.email,
          displayName: user.displayName,
          expiresAt: expiresAt.toISOString(),
          kind,
        },
      });
    });
    const assignment = await this.prisma.orgUserAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: { user: true },
    });
    return this.toIssue(assignment, raw, expiresAt);
  }

  private async findValidInvite(rawToken: string) {
    const token = rawToken?.trim();
    if (!token || token.length < 16) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Invitation invalide ou expirée.',
        HttpStatus.NOT_FOUND,
      );
    }
    const hash = this.hashToken(token);
    const invite = await this.prisma.iamInvite.findFirst({
      where: {
        tokenHash: hash,
        consumedAt: null,
        user: { deletedAt: null, status: IamUserStatus.INVITED },
      },
      include: { user: true },
    });
    if (!invite || invite.expiresAt.getTime() < Date.now()) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Invitation invalide ou expirée.',
        HttpStatus.NOT_FOUND,
      );
    }
    return invite;
  }

  private newToken() {
    const raw = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    return { raw, hash: this.hashToken(raw), expiresAt };
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  private webOrigin() {
    return (
      process.env.AUTHORITY_WEB_ORIGIN?.replace(/\/$/, '') ||
      'http://localhost:3000'
    );
  }

  private toUserDto(assignment: {
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
      id: assignment.user.id,
      email: assignment.user.email,
      displayName: assignment.user.displayName,
      status: assignment.user.status,
      locale: assignment.user.locale,
      timezone: assignment.user.timezone,
      mfaEnabled: assignment.user.mfaEnabled,
      roleCode: assignment.roleCode,
      assignmentId: assignment.id,
      inviteExpiresAt: null,
      createdAt: assignment.user.createdAt.toISOString(),
      updatedAt: assignment.user.updatedAt.toISOString(),
    };
  }

  private toIssue(
    assignment: {
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
    },
    raw: string,
    expiresAt: Date,
  ): InviteIssueResult {
    const inviteUrl = `${this.webOrigin()}/invite/${raw}`;
    const subject = encodeURIComponent('Invitation AUTHORITY');
    const body = encodeURIComponent(
      `Bonjour ${assignment.user.displayName},\n\nVous êtes invité(e) sur AUTHORITY.\nDéfinissez votre mot de passe via ce lien (valide ${INVITE_TTL_DAYS} jours) :\n${inviteUrl}\n\n— AUTHORITY`,
    );
    return {
      user: {
        ...this.toUserDto(assignment),
        inviteExpiresAt: expiresAt.toISOString(),
      },
      inviteUrl,
      mailtoHref: `mailto:${assignment.user.email}?subject=${subject}&body=${body}`,
      expiresAt: expiresAt.toISOString(),
      alreadyActive: false,
    };
  }
}

import { HttpStatus, Injectable } from '@nestjs/common';
import { IamSessionRealm, IamUser, IamUserStatus } from '@prisma/client';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  OUTBOX_EVENT_TYPES,
} from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../audit/outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { IDENTITY_DEFAULTS, IDENTITY_ERROR_CODES } from './identity.constants';
import { IdentityException } from './identity.exception';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { BUSINESS_ROLE_CATALOGUE } from './business-roles';
import type { BusinessRoleCode } from './business-roles';

export interface LoginResult {
  user: {
    id: string;
    email: string;
    displayName: string;
    status: IamUserStatus;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  };
  session: { id: string; expiresAt: Date };
  token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  async login(params: {
    email: string;
    password: string;
    ip?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const user = await this.authenticatePassword(params);

    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: user.id,
        email: user.email,
        ip: params.ip,
        success: true,
      },
    });

    const { session, token } = await this.sessionService.createSession({
      userId: user.id,
      ip: params.ip,
      userAgent: params.userAgent,
      realm: IamSessionRealm.BUSINESS,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        locale: user.locale,
        timezone: user.timezone,
        mfaEnabled: user.mfaEnabled,
      },
      session: { id: session.id, expiresAt: session.expiresAt },
      token,
    };
  }

  async authenticatePassword(params: {
    email: string;
    password: string;
    ip?: string;
  }): Promise<IamUser> {
    const email = params.email.trim().toLowerCase();
    const user = await this.prisma.iamUser.findUnique({ where: { email } });

    if (!user || user.deletedAt) {
      await this.recordFailedAttempt(null, email, params.ip);
      throw this.invalidCredentials();
    }

    if (user.status === IamUserStatus.LOCKED) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.LOCKED,
        'Account is locked.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (
      user.status !== IamUserStatus.ACTIVE ||
      !user.passwordHash ||
      !(await this.passwordService.verify(user.passwordHash, params.password))
    ) {
      await this.recordFailedAttempt(user.id, email, params.ip);
      await this.applyLockoutIfNeeded(user.id);
      throw this.invalidCredentials();
    }

    return user;
  }

  /** Session step-up: verify password for the already-authenticated user. */
  async verifyCurrentPassword(params: {
    userId: string;
    password: string;
    ip?: string;
  }): Promise<void> {
    const user = await this.prisma.iamUser.findUnique({
      where: { id: params.userId },
    });
    if (!user || user.deletedAt || user.status !== IamUserStatus.ACTIVE) {
      throw this.invalidCredentials();
    }
    if (
      !user.passwordHash ||
      !(await this.passwordService.verify(user.passwordHash, params.password))
    ) {
      await this.recordFailedAttempt(user.id, user.email, params.ip);
      await this.applyLockoutIfNeeded(user.id);
      throw this.invalidCredentials();
    }
  }

  toMeResponse(user: {
    id: string;
    email: string;
    displayName: string;
    status: IamUserStatus;
    locale: string;
    timezone: string;
    mfaEnabled: boolean;
  }) {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      locale: user.locale,
      timezone: user.timezone,
      mfaEnabled: user.mfaEnabled,
      roleCode: null as string | null,
      roleLabel: null as string | null,
    };
  }

  /** Me payload with company-scoped business role (D114). */
  async buildMeResponse(
    user: {
      id: string;
      email: string;
      displayName: string;
      status: IamUserStatus;
      locale: string;
      timezone: string;
      mfaEnabled: boolean;
    },
    companyId?: string | null,
  ) {
    const base = this.toMeResponse(user);
    if (!companyId) {
      return base;
    }

    const assignment = await this.prisma.orgUserAssignment.findFirst({
      where: {
        userId: user.id,
        companyId,
        deletedAt: null,
      },
      select: { roleCode: true },
    });

    const roleCode = assignment?.roleCode ?? null;
    const roleLabel = roleCode
      ? (BUSINESS_ROLE_CATALOGUE.find(
          (r) => r.code === (roleCode as BusinessRoleCode),
        )?.label ?? roleCode)
      : null;

    return {
      ...base,
      roleCode,
      roleLabel,
    };
  }

  async updateProfile(params: {
    userId: string;
    displayName?: string;
    locale?: string;
    currentPassword?: string;
    password?: string;
    companyId?: string;
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<Awaited<ReturnType<AuthService['buildMeResponse']>>> {
    const wantsPassword = Boolean(params.password?.trim());
    if (
      !params.displayName &&
      !params.locale &&
      !wantsPassword
    ) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Provide displayName, locale, and/or password.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let passwordHash: string | undefined;
    if (wantsPassword) {
      if (!params.currentPassword?.trim()) {
        throw new IdentityException(
          IDENTITY_ERROR_CODES.VALIDATION,
          'currentPassword is required to change password.',
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.verifyCurrentPassword({
        userId: params.userId,
        password: params.currentPassword,
        ip: params.ip,
      });
      passwordHash = await this.passwordService.hash(params.password!.trim());
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.iamUser.findUniqueOrThrow({
        where: { id: params.userId },
      });

      const after = await tx.iamUser.update({
        where: { id: params.userId },
        data: {
          ...(params.displayName !== undefined
            ? { displayName: params.displayName }
            : {}),
          ...(params.locale !== undefined ? { locale: params.locale } : {}),
          ...(passwordHash !== undefined ? { passwordHash } : {}),
          version: { increment: 1 },
        },
      });

      const snapshot = (user: IamUser) => this.toMeResponse(user);

      await this.auditService.append(tx, {
        companyId: params.companyId,
        siteId: params.siteId,
        actorUserId: params.userId,
        action: AUDIT_ACTIONS.identityUserUpdate,
        entityType: AUDIT_ENTITY_TYPES.iamUser,
        entityId: params.userId,
        beforeJson: snapshot(before),
        afterJson: {
          ...snapshot(after),
          ...(passwordHash ? { passwordChanged: true } : {}),
        },
        ip: params.ip,
        device: params.userAgent,
        correlationId: params.correlationId,
      });

      await this.outboxService.enqueue(tx, {
        companyId: params.companyId,
        aggregateType: AUDIT_ENTITY_TYPES.iamUser,
        aggregateId: params.userId,
        eventType: OUTBOX_EVENT_TYPES.identityUserUpdated,
        payloadJson: {
          eventType: OUTBOX_EVENT_TYPES.identityUserUpdated,
          eventVersion: 1,
          source: 'identity',
          actorId: params.userId,
          companyId: params.companyId ?? null,
          siteId: params.siteId ?? null,
          correlationId: params.correlationId ?? null,
          payload: snapshot(after),
        },
      });

      return after;
    });

    return this.buildMeResponse(updated, params.companyId);
  }

  private invalidCredentials(): IdentityException {
    return new IdentityException(
      IDENTITY_ERROR_CODES.INVALID_CREDENTIALS,
      'Invalid email or password.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  private async recordFailedAttempt(
    userId: string | null,
    email: string,
    ip?: string,
  ): Promise<void> {
    await this.prisma.iamLoginAttempt.create({
      data: {
        userId: userId ?? undefined,
        email,
        ip,
        success: false,
      },
    });
  }

  private async applyLockoutIfNeeded(userId: string): Promise<void> {
    const since = new Date(
      Date.now() - IDENTITY_DEFAULTS.lockoutWindowMinutes * 60 * 1000,
    );

    const failures = await this.prisma.iamLoginAttempt.count({
      where: {
        userId,
        success: false,
        createdAt: { gte: since },
      },
    });

    if (failures >= IDENTITY_DEFAULTS.lockoutThreshold) {
      await this.prisma.iamUser.update({
        where: { id: userId },
        data: { status: IamUserStatus.LOCKED },
      });
    }
  }
}

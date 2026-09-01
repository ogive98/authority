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
    };
  }

  async updateProfile(params: {
    userId: string;
    displayName?: string;
    locale?: string;
    companyId?: string;
    siteId?: string;
    ip?: string;
    userAgent?: string;
    correlationId?: string;
  }): Promise<ReturnType<AuthService['toMeResponse']>> {
    if (!params.displayName && !params.locale) {
      throw new IdentityException(
        IDENTITY_ERROR_CODES.VALIDATION,
        'Provide displayName and/or locale.',
        HttpStatus.BAD_REQUEST,
      );
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
        afterJson: snapshot(after),
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

    return this.toMeResponse(updated);
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
